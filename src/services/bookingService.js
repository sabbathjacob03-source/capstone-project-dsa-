import { DomainError } from '../domain/errors.js';
import { assertTransition } from '../domain/bookingStateMachine.js';
import { newId, newReference } from '../domain/ids.js';
import { loadDomainStore } from './domainStore.js';
import { charge as defaultCharge } from '../lib/mockPaymentGateway.js';

const MAX_TICKETS_PER_BOOKING = 10;

function requireUserId(userId) {
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new DomainError('UNAUTHENTICATED', 'The x-user-id header is required');
  }
  return userId.trim();
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', `${label} must be an object`);
  }
  return value;
}

export async function bookTickets(repository, userId, input) {
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
  const seatsLeft = tier.capacity - tier.sold;
  if (seatsLeft < quantity) {
    throw new DomainError('SOLD_OUT', `Only ${seatsLeft} ticket(s) left in ${tier.name}`, {
      seatsLeft,
    });
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
    createdAt: new Date().toISOString(),
  };
  tier.sold += quantity;
  await Promise.all([
    repository.tiers.save(tier),
    repository.bookings.save(booking),
  ]);
  return booking;
}

export async function payBooking(
  repository,
  userId,
  reference,
  paymentRequest = {},
  paymentGateway = defaultCharge,
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
  assertTransition(booking.status, 'paid');

  const result = await paymentGateway({ decline: input.decline ?? false });
  if (!result || (result.status !== 'succeeded' && result.status !== 'declined')) {
    throw new DomainError('PAYMENT_FAILED', 'Payment gateway returned an invalid result');
  }
  if (result.status === 'declined') {
    throw new DomainError('PAYMENT_DECLINED', 'Payment was declined');
  }

  booking.status = 'paid';
  await repository.bookings.save(booking);
  return booking;
}

export async function cancelBooking(repository, userId, reference) {
  const attendeeId = requireUserId(userId);
  const store = await loadDomainStore(repository);
  const booking = store.bookingsByReference.get(reference);
  if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
  if (booking.userId !== attendeeId) {
    throw new DomainError('FORBIDDEN', 'Only the booking owner can cancel this booking');
  }
  if (booking.status !== 'pending') {
    throw new DomainError('INVALID_STATE', 'Only unpaid bookings can be cancelled');
  }

  assertTransition(booking.status, 'cancelled');
  const tier = store.tiers.get(booking.tierId);
  if (!tier || tier.sold < booking.quantity) {
    throw new DomainError('INVALID_STATE', 'Cancelling this booking would make sold inventory negative');
  }
  tier.sold -= booking.quantity;
  booking.status = 'cancelled';
  await Promise.all([
    repository.tiers.save(tier),
    repository.bookings.save(booking),
  ]);
  return booking;
}
