import { DomainError } from './errors.js';

export const BOOKING_STATES = Object.freeze([
  'pending',
  'payment_processing',
  'paid',
  'refunding',
  'cancelled',
  'refunded',
  'checked_in',
]);

export const BOOKING_TRANSITIONS = Object.freeze({
  pending: Object.freeze(['payment_processing', 'cancelled']),
  payment_processing: Object.freeze(['pending', 'paid']),
  paid: Object.freeze(['checked_in', 'refunding', 'cancelled']),
  refunding: Object.freeze(['paid', 'refunded']),
  cancelled: Object.freeze([]),
  refunded: Object.freeze([]),
  checked_in: Object.freeze([]),
});

export function canTransition(from, to) {
  return BOOKING_STATES.includes(from) &&
    BOOKING_STATES.includes(to) &&
    BOOKING_TRANSITIONS[from].includes(to);
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `Booking cannot transition from "${from}" to "${to}"`,
      { from, to },
    );
  }
}
