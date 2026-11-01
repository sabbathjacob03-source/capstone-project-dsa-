import { DomainError } from '../domain/errors.js';
import {
  addTier as addTierRule,
  createEvent as createEventRule,
  listEventSummaries,
  publishEvent as publishEventRule,
} from '../domain/inventory.js';
import { searchEvents } from '../domain/eventSearch.js';
import { loadDomainStore } from './domainStore.js';

function requireUserId(userId) {
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new DomainError('UNAUTHENTICATED', 'The x-user-id header is required');
  }
  return userId.trim();
}

export async function createEvent(repository, userId, input) {
  const organizerId = requireUserId(userId);
  const store = await loadDomainStore(repository);
  const event = createEventRule(store, input);
  event.organizerId = organizerId;
  await repository.events.save(event);
  return event;
}

export async function addTier(repository, eventId, input) {
  const store = await loadDomainStore(repository);
  const tier = addTierRule(store, eventId, input);
  await Promise.all([
    repository.events.save(store.events.get(eventId)),
    repository.tiers.save(tier),
  ]);
  return tier;
}

export async function publishEvent(repository, eventId) {
  const store = await loadDomainStore(repository);
  const event = publishEventRule(store, eventId);
  await repository.events.save(event);
  return event;
}

export async function listEvents(repository, criteria = {}, sortBy = 'date') {
  const store = await loadDomainStore(repository);
  return searchEvents(listEventSummaries(store), criteria, sortBy);
}
