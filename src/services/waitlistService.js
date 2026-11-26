import { DomainError } from '../domain/errors.js';
import { newId, newReference } from '../domain/ids.js';
import { loadDomainStore } from './domainStore.js';
import { BOOKING_HOLD_DURATION_MS, WAITLIST_OFFER_DURATION_MS } from './seatService.js';
import { systemClock } from '../lib/clock.js';

function requireUserId(userId) {
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new DomainError('UNAUTHENTICATED', 'A bearer token is required');
  }
  return userId.trim();
}

export async function joinWaitlist(repository, userId, input, clock = systemClock) {
  const attendeeId = requireUserId(userId);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new DomainError('VALIDATION', 'Waitlist request must be an object');
  }
  if (typeof input.tierId !== 'string' || input.tierId.trim() === '') {
    throw new DomainError('VALIDATION', 'Ticket tier ID is required');
  }
  const store = await loadDomainStore(repository);
  const tier = store.tiers.get(input.tierId);
  if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');
  const event = store.events.get(tier.eventId);
  if (!event || event.status !== 'published') {
    throw new DomainError('INVALID_STATE', 'You can only join a waitlist for a published event');
  }
  const now = clock.now().toISOString();
  await repository.expireWaitlistOffers({
    now,
    offerDurationMs: WAITLIST_OFFER_DURATION_MS,
  });
  const entry = {
    id: newId(),
    userId: attendeeId,
    eventId: event.id,
    tierId: tier.id,
    createdAt: now,
    status: 'waiting',
    offerExpiresAt: null,
  };
  await repository.joinWaitlist(entry);
  return entry;
}

export async function listOffers(repository, userId, clock = systemClock) {
  const attendeeId = requireUserId(userId);
  const now = clock.now().toISOString();
  await repository.expireWaitlistOffers({
    now,
    offerDurationMs: WAITLIST_OFFER_DURATION_MS,
  });
  const store = await loadDomainStore(repository);
  const entries = await repository.waitlist.list();
  return entries
    .filter((entry) =>
      entry.userId === attendeeId &&
      entry.status === 'offered' &&
      Date.parse(entry.offerExpiresAt) > Date.parse(now))
    .map((entry) => {
      const event = store.events.get(entry.eventId);
      const tier = store.tiers.get(entry.tierId);
      return {
        ...entry,
        eventTitle: event?.title ?? 'Event',
        tierName: tier?.name ?? 'Ticket tier',
      };
    });
}

export async function acceptOffer(repository, userId, id, clock = systemClock) {
  const attendeeId = requireUserId(userId);
  if (typeof id !== 'string' || id.trim() === '') {
    throw new DomainError('VALIDATION', 'Waitlist offer ID is required');
  }
  const now = clock.now();
  const store = await loadDomainStore(repository);
  const entry = (await repository.waitlist.findById(id));
  if (!entry || entry.userId !== attendeeId) {
    throw new DomainError('NOT_FOUND', 'Waitlist offer not found');
  }
  if (entry.status === 'expired') {
    throw new DomainError('OFFER_EXPIRED', 'The waitlist offer has expired');
  }
  if (entry.status !== 'offered') {
    throw new DomainError('INVALID_STATE', 'The waitlist offer is no longer available');
  }
  const tier = store.tiers.get(entry.tierId);
  const event = store.events.get(entry.eventId);
  if (!tier || !event) throw new DomainError('NOT_FOUND', 'Ticket tier not found');
  const amountCents = tier.priceCents;
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
    quantity: 1,
    amountCents,
    status: 'pending',
    createdAt: now.toISOString(),
    holdExpiresAt: new Date(now.getTime() + BOOKING_HOLD_DURATION_MS).toISOString(),
  };
  const result = await repository.acceptWaitlistOffer({
    id,
    userId: attendeeId,
    now: now.toISOString(),
    booking,
    offerDurationMs: WAITLIST_OFFER_DURATION_MS,
  });
  if (result.expired) {
    throw new DomainError('OFFER_EXPIRED', 'The waitlist offer has expired');
  }
  if (result.notFound) throw new DomainError('NOT_FOUND', 'Waitlist offer not found');
  if (result.invalid) throw new DomainError('INVALID_STATE', 'The waitlist offer is no longer available');
  return result.booking;
}
