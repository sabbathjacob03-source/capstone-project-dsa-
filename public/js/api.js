import { events } from './mockData.js';

const delay = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 120));
const clone = (value) => JSON.parse(JSON.stringify(value));

export async function listEvents(criteria = {}) {
  let result = events.filter((event) => event.published);
  if (criteria.q) {
    const query = String(criteria.q).toLowerCase();
    result = result.filter((event) => event.title.toLowerCase().includes(query) || event.venue.toLowerCase().includes(query));
  }
  if (criteria.city) result = result.filter((event) => event.city.toLowerCase() === String(criteria.city).toLowerCase());
  if (criteria.maxPriceCents != null && criteria.maxPriceCents !== '') {
    const maximum = Number(criteria.maxPriceCents);
    if (!Number.isInteger(maximum) || maximum < 0) throw new Error('VALIDATION: Maximum price must be whole cents');
    result = result.filter((event) => event.tiers.length > 0 &&
      Math.min(...event.tiers.map((tier) => tier.priceCents)) <= maximum);
  }
  const sortBy = criteria.sortBy || 'date';
  result = [...result].sort((a, b) => {
    if (sortBy === 'price') {
      const aPrice = Math.min(...a.tiers.map((tier) => tier.priceCents));
      const bPrice = Math.min(...b.tiers.map((tier) => tier.priceCents));
      return aPrice - bPrice || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    }
    if (sortBy === 'availability') {
      const aSeats = a.tiers.reduce((sum, tier) => sum + tier.seatsLeft, 0);
      const bSeats = b.tiers.reduce((sum, tier) => sum + tier.seatsLeft, 0);
      return bSeats - aSeats || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    }
    return new Date(a.startsAt) - new Date(b.startsAt) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
  return delay(clone(result));
}

export async function getEvent(eventId) {
  const event = events.find((item) => item.id === eventId);
  if (!event) throw new Error(`NOT_FOUND: Event ${eventId} was not found`);
  return delay(clone(event));
}

export async function createBooking({ tierId, quantity }) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('VALIDATION: Quantity must be a whole number');
  if (quantity > 10) throw new Error('VALIDATION: Quantity cannot exceed 10');
  let tier;
  let event;
  for (const candidateEvent of events) {
    tier = candidateEvent.tiers.find((item) => item.id === tierId);
    if (tier) {
      event = candidateEvent;
      break;
    }
  }
  if (!tier) throw new Error('NOT_FOUND: Ticket tier was not found');
  if (quantity > tier.seatsLeft) throw new Error('SOLD_OUT: Not enough seats remain');
  tier.seatsLeft -= quantity;
  return delay(clone({
    reference: `BK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    status: 'pending',
    tierId,
    tierName: tier.name,
    eventId: event.id,
    eventTitle: event.title,
    quantity,
    totalCents: tier.priceCents * quantity,
    holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }));
}

export async function pay(referenceOrBooking, options = {}) {
  const reference = typeof referenceOrBooking === 'string' ? referenceOrBooking : referenceOrBooking.reference;
  const decline = typeof referenceOrBooking === 'object'
    ? Boolean(referenceOrBooking.decline)
    : Boolean(options.decline);
  if (decline) throw new Error('PAYMENT_DECLINED: The mock card was declined');
  return delay({ reference, status: 'paid' });
}
