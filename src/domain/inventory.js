import { DomainError } from './errors.js';
import { newId } from './ids.js';

export function createStore() {
  return {
    events: new Map(),
    tiers: new Map(),
    bookings: new Map(),
    bookingsByReference: new Map(),
    waitlists: new Map(),
  };
}

function requireStore(store) {
  if (
    !store ||
    !(store.events instanceof Map) ||
    !(store.tiers instanceof Map) ||
    !(store.bookings instanceof Map) ||
    !(store.bookingsByReference instanceof Map) ||
    !(store.waitlists instanceof Map)
  ) {
    throw new DomainError('VALIDATION', 'A valid store is required');
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', `${label} must be an object`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${label} is required`);
  }
  return value.trim();
}

function requireEvent(store, eventId) {
  requireStore(store);
  const id = requireText(eventId, 'Event ID');
  const event = store.events.get(id);
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  return event;
}

export function createEvent(store, input) {
  requireStore(store);
  const eventInput = requireObject(input, 'Event');
  const title = requireText(eventInput.title, 'Title');
  const city = requireText(eventInput.city, 'City');
  const venue = eventInput.venue === undefined ? '' : eventInput.venue;
  if (typeof venue !== 'string') {
    throw new DomainError('VALIDATION', 'Venue must be a string');
  }
  if (typeof eventInput.startsAt !== 'string' || eventInput.startsAt.trim() === '') {
    throw new DomainError('VALIDATION', 'Start time must be a valid date');
  }
  const startsAt = new Date(eventInput.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new DomainError('VALIDATION', 'Start time must be a valid date');
  }

  const event = {
    id: newId(),
    title,
    city,
    venue: venue.trim(),
    startsAt: startsAt.toISOString(),
    status: 'draft',
    tierIds: [],
  };
  store.events.set(event.id, event);
  return event;
}

export function addTier(store, eventId, input) {
  const event = requireEvent(store, eventId);
  const tierInput = requireObject(input, 'Ticket tier');
  const name = requireText(tierInput.name, 'Tier name');
  const { priceCents, capacity } = tierInput;
  if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
    throw new DomainError('VALIDATION', 'Price in cents must be a non-negative whole number');
  }
  if (!Number.isSafeInteger(capacity) || capacity < 1) {
    throw new DomainError('VALIDATION', 'Capacity must be a positive whole number');
  }

  const tier = {
    id: newId(),
    eventId: event.id,
    name,
    priceCents,
    capacity,
    sold: 0,
  };
  store.tiers.set(tier.id, tier);
  event.tierIds.push(tier.id);
  return tier;
}

export function publishEvent(store, eventId) {
  const event = requireEvent(store, eventId);
  if (event.tierIds.length === 0) {
    throw new DomainError('INVALID_STATE', 'Add at least one ticket tier before publishing');
  }
  event.status = 'published';
  return event;
}

function summarizeEvent(event, tiers) {
  const prices = tiers.map((tier) => tier.priceCents);
  const seatsLeft = tiers.reduce((total, tier) => total + tier.capacity - tier.sold, 0);
  return {
    id: event.id,
    title: event.title,
    city: event.city,
    venue: event.venue,
    startsAt: event.startsAt,
    status: event.status,
    tierCount: tiers.length,
    minPriceCents: prices.length === 0 ? null : Math.min(...prices),
    maxPriceCents: prices.length === 0 ? null : Math.max(...prices),
    seatsLeft,
  };
}

export function listEventSummaries(store, options = {}) {
  requireStore(store);
  const { publishedOnly = true } = requireObject(options, 'List options');
  if (typeof publishedOnly !== 'boolean') {
    throw new DomainError('VALIDATION', 'publishedOnly must be a boolean');
  }

  const summaries = [];
  for (const event of store.events.values()) {
    if (publishedOnly && event.status !== 'published') continue;
    const tiers = event.tierIds.map((tierId) => {
      const tier = store.tiers.get(tierId);
      if (!tier) throw new DomainError('INVALID_STATE', 'Event references a missing ticket tier');
      return tier;
    });
    summaries.push(summarizeEvent(event, tiers));
  }
  return summaries;
}
