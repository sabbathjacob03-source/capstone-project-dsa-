import { DomainError } from '../domain/errors.js';
import { createStore } from '../domain/inventory.js';

export async function loadDomainStore(repository) {
  if (
    !repository?.events ||
    typeof repository.events.list !== 'function' ||
    !repository.tiers ||
    typeof repository.tiers.list !== 'function' ||
    !repository.bookings ||
    typeof repository.bookings.list !== 'function'
  ) {
    throw new DomainError('VALIDATION', 'A compatible repository is required');
  }

  const [events, tiers, bookings] = await Promise.all([
    repository.events.list(),
    repository.tiers.list(),
    repository.bookings.list(),
  ]);
  const store = createStore();

  for (const event of events) store.events.set(event.id, event);
  for (const tier of tiers) {
    store.tiers.set(tier.id, tier);
  }
  for (const booking of bookings) {
    store.bookings.set(booking.id, booking);
    store.bookingsByReference.set(booking.reference, booking);
  }

  return store;
}
