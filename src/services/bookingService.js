import { DomainError } from '../domain/errors.js';
import { assertTransition } from '../domain/bookingStateMachine.js';
import { newId, newReference } from '../domain/ids.js';
import { calculateRefund } from '../domain/refundPolicy.js';
import { loadDomainStore } from './domainStore.js';
import {
  BOOKING_HOLD_DURATION_MS,
  WAITLIST_OFFER_DURATION_MS,
  completeRefundAndReleaseSeats,
  expireHeldBookings,
  releaseBookingSeats,
} from './seatService.js';
import { charge as defaultCharge, refund as defaultRefund } from '../lib/mockPaymentGateway.js';
import { systemClock } from '../lib/clock.js';

const MAX_TICKETS_PER_BOOKING = 10;

function requireUserId(userId) {
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new DomainError('UNAUTHENTICATED', 'A bearer token is required');
  }
  return userId.trim();
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', `${label} must be an object`);
  }
  return value;
}

export async function bookTickets(repository, userId, input, clock = systemClock) {
  const attendeeId = requireUserId(userId);
  const bookingInput = requireObject(input, 'Booking');
  const store = await loadDomainStore(repository);
  const tier = store.tiers.get(bookingInput.tierId);
  if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');
  const event = store.events.get(tier.eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  if (event.status !== 'published') {
    throw new DomainError('INVALID_STATE', 'Tickets can only be booked for published events');
  }

  const { quantity } = bookingInput;
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_TICKETS_PER_BOOKING
  ) {
    throw new DomainError(
      'VALIDATION',
      `Quantity must be a whole number from 1 to ${MAX_TICKETS_PER_BOOKING}`,
    );
  }
  const amountCents = tier.priceCents * quantity;
  if (!Number.isSafeInteger(amountCents)) {
    throw new DomainError('VALIDATION', 'Booking amount must be a safe whole number of cents');
  }
  let reference;
  do {
    reference = newReference();
  } while (store.bookingsByReference.has(reference));

  const booking = {
    id: newId(),
    reference,
    userId: attendeeId,
    eventId: event.id,
    tierId: tier.id,
    quantity,
    amountCents,
    status: 'pending',
    createdAt: clock.now().toISOString(),
  };
  booking.holdExpiresAt = new Date(
    Date.parse(booking.createdAt) + BOOKING_HOLD_DURATION_MS,
  ).toISOString();
  await repository.reserveBooking(booking);
  return booking;
}

export async function payBooking(
  repository,
  userId,
  reference,
  paymentRequest = {},
  paymentGateway = defaultCharge,
  clock = systemClock,
) {
  const attendeeId = requireUserId(userId);
  const input = requireObject(paymentRequest, 'Payment');
  if (input.decline !== undefined && typeof input.decline !== 'boolean') {
    throw new DomainError('VALIDATION', 'Payment decline flag must be a boolean');
  }

  const store = await loadDomainStore(repository);
  const booking = store.bookingsByReference.get(reference);
  if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
  if (booking.userId !== attendeeId) {
    throw new DomainError('FORBIDDEN', 'Only the booking owner can pay for this booking');
  }
  const now = clock.now();
  const holdExpiresAt = booking.holdExpiresAt ??
    new Date(Date.parse(booking.createdAt) + BOOKING_HOLD_DURATION_MS).toISOString();
  if (
    ['pending', 'cancelled'].includes(booking.status) &&
    Date.parse(holdExpiresAt) <= now.getTime()
  ) {
    if (booking.status === 'pending') {
      await expireHeldBookings(repository, {
        now: now.toISOString(),
        holdDurationMs: BOOKING_HOLD_DURATION_MS,
        offerDurationMs: WAITLIST_OFFER_DURATION_MS,
      });
    }
    throw new DomainError('BOOKING_EXPIRED', 'The booking hold has expired');
  }
  assertTransition(booking.status, 'payment_processing');
  const claimed = await repository.claimBookingStatus(
    reference,
    attendeeId,
    'pending',
    'payment_processing',
  );
  if (!claimed) throw new DomainError('INVALID_STATE', 'The booking is no longer available for payment');

  try {
    const result = await paymentGateway({ decline: input.decline ?? false });
    if (!result || (result.status !== 'succeeded' && result.status !== 'declined')) {
      throw new DomainError('PAYMENT_FAILED', 'Payment gateway returned an invalid result');
    }
    if (result.status === 'declined') {
      throw new DomainError('PAYMENT_DECLINED', 'Payment was declined');
    }
    assertTransition('payment_processing', 'paid');
    const paidBooking = await repository.claimBookingStatus(
      reference,
      attendeeId,
      'payment_processing',
      'paid',
    );
    if (!paidBooking) throw new DomainError('INVALID_STATE', 'The booking could not be marked paid');
    return paidBooking;
  } catch (error) {
    await repository.claimBookingStatus(
      reference,
      attendeeId,
      'payment_processing',
      'pending',
    );
    throw error;
  }
}

export async function previewBookingRefund(repository, userId, reference, clock = systemClock) {
  const attendeeId = requireUserId(userId);
  const store = await loadDomainStore(repository);
  const booking = store.bookingsByReference.get(reference);
  if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
  if (booking.userId !== attendeeId) {
    throw new DomainError('NOT_FOUND', 'Booking not found');
  }
  if (booking.status === 'pending') {
    return { refundAmountCents: 0 };
  }
  if (booking.status !== 'paid') {
    throw new DomainError('INVALID_STATE', 'Only pending or paid bookings can be cancelled');
  }
  const event = store.events.get(booking.eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  return {
    refundAmountCents: calculateRefund({
      amountCents: booking.amountCents,
      startsAt: event.startsAt,
      now: clock.now(),
    }),
  };
}

export async function cancelBooking(
  repository,
  userId,
  reference,
  refundGateway = defaultRefund,
  clock = systemClock,
) {
  const attendeeId = requireUserId(userId);
  const store = await loadDomainStore(repository);
  const booking = store.bookingsByReference.get(reference);
  if (!booking || booking.userId !== attendeeId) {
    throw new DomainError('NOT_FOUND', 'Booking not found');
  }
  const now = clock.now();

  if (booking.status === 'pending') {
    assertTransition(booking.status, 'cancelled');
    const cancelled = await releaseBookingSeats(repository, {
      reference,
      userId: attendeeId,
      expectedStatus: 'pending',
      nextStatus: 'cancelled',
      now: now.toISOString(),
      offerDurationMs: WAITLIST_OFFER_DURATION_MS,
    });
    if (!cancelled) throw new DomainError('INVALID_STATE', 'The booking is no longer pending');
    return cancelled;
  }

  if (booking.status !== 'paid') {
    throw new DomainError('INVALID_STATE', 'Only pending or paid bookings can be cancelled');
  }
  assertTransition(booking.status, 'refunding');
  const event = store.events.get(booking.eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  const refundAmountCents = calculateRefund({
    amountCents: booking.amountCents,
    startsAt: event.startsAt,
    now,
  });
  const claimed = await repository.claimBookingStatus(
    reference,
    attendeeId,
    'paid',
    'refunding',
  );
  if (!claimed) throw new DomainError('INVALID_STATE', 'The booking is no longer paid');
  try {
    const result = await refundGateway({ amountCents: refundAmountCents, reference });
    if (!result || result.status !== 'succeeded') {
      throw new DomainError('REFUND_FAILED', 'Refund gateway returned an invalid result');
    }
    assertTransition('refunding', 'refunded');
    const refunded = await completeRefundAndReleaseSeats(repository, {
      reference,
      userId: attendeeId,
      now: now.toISOString(),
      offerDurationMs: WAITLIST_OFFER_DURATION_MS,
      refundAmountCents,
    });
    if (!refunded) throw new DomainError('INVALID_STATE', 'The refund could not be completed');
    return refunded;
  } catch (error) {
    await repository.restoreRefundClaim(reference, attendeeId);
    throw error;
  }
}

export async function getBooking(repository, userId, reference) {
  const attendeeId = requireUserId(userId);
  const store = await loadDomainStore(repository);
  const booking = store.bookingsByReference.get(reference);
  if (!booking || booking.userId !== attendeeId) {
    throw new DomainError('NOT_FOUND', 'Booking not found');
  }
  return booking;
}

export async function listBookings(repository, userId) {
  const attendeeId = requireUserId(userId);
  const store = await loadDomainStore(repository);
  return [...store.bookings.values()].filter((booking) => booking.userId === attendeeId);
}
