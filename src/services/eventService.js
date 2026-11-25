import { DomainError } from '../domain/errors.js';
import {
  addTier as addTierRule,
  createEvent as createEventRule,
  listEventSummaries,
  publishEvent as publishEventRule,
} from '../domain/inventory.js';
import { searchEvents } from '../domain/eventSearch.js';
import { loadDomainStore } from './domainStore.js';

export async function createEvent(repository, organizerId, input) {
  if (typeof organizerId !== 'string' || organizerId.trim() === '') {
    throw new DomainError('UNAUTHENTICATED', 'A bearer token is required');
  }
  const store = await loadDomainStore(repository);
  const event = createEventRule(store, input);
  event.organizerId = organizerId.trim();
  await repository.events.save(event);
  return event;
}

export async function addTier(repository, eventId, organizerId, input) {
  if (input === undefined) {
    input = organizerId;
    organizerId = undefined;
  }
  const store = await loadDomainStore(repository);
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  if (organizerId !== undefined && event.organizerId !== organizerId) {
    throw new DomainError('FORBIDDEN', 'Only the event organizer can change this event');
  }
  const tier = addTierRule(store, eventId, input);
  await Promise.all([
    repository.events.save(event),
    repository.tiers.save(tier),
  ]);
  return tier;
}

export async function publishEvent(repository, eventId, organizerId) {
  const store = await loadDomainStore(repository);
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  if (organizerId !== undefined && event.organizerId !== organizerId) {
    throw new DomainError('FORBIDDEN', 'Only the event organizer can change this event');
  }
  const published = publishEventRule(store, eventId);
  await repository.events.save(published);
  return published;
}

export async function listEvents(repository, criteria = {}, sortBy = 'date') {
  const store = await loadDomainStore(repository);
  return searchEvents(listEventSummaries(store), criteria, sortBy);
}

export async function getEvent(repository, eventId) {
  const store = await loadDomainStore(repository);
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  if (event.status !== 'published') {
    throw new DomainError('NOT_FOUND', 'Event not found');
  }
  const tiers = event.tierIds.map((tierId) => {
    const tier = store.tiers.get(tierId);
    if (!tier) throw new DomainError('INVALID_STATE', 'Event references a missing ticket tier');
    return {
      id: tier.id,
      eventId: tier.eventId,
      name: tier.name,
      priceCents: tier.priceCents,
      capacity: tier.capacity,
      sold: tier.sold,
      seatsLeft: tier.capacity - tier.sold,
    };
  });
  return { ...event, tiers };
}

export async function listOrganizerEvents(repository, organizerId) {
  const store = await loadDomainStore(repository);
  return [...store.events.values()]
    .filter((event) => event.organizerId === organizerId)
    .map((event) => ({
      ...event,
      tiers: event.tierIds.map((tierId) => {
        const tier = store.tiers.get(tierId);
        if (!tier) throw new DomainError('INVALID_STATE', 'Event references a missing ticket tier');
        return {
          id: tier.id,
          eventId: tier.eventId,
          name: tier.name,
          priceCents: tier.priceCents,
          capacity: tier.capacity,
          sold: tier.sold,
          seatsLeft: tier.capacity - tier.sold,
        };
      }),
    }));
}
