import { systemClock } from '../lib/clock.js';

export const BOOKING_HOLD_DURATION_MS = 15 * 60 * 1000;
export const WAITLIST_OFFER_DURATION_MS = 15 * 60 * 1000;

export async function releaseBookingSeats(repository, options) {
  return repository.cancelBookingAndRelease(options);
}

export async function completeRefundAndReleaseSeats(repository, options) {
  return repository.completeRefund(options);
}

export async function expireHeldBookings(repository, {
  now = systemClock.now().toISOString(),
  holdDurationMs = BOOKING_HOLD_DURATION_MS,
  offerDurationMs = WAITLIST_OFFER_DURATION_MS,
} = {}) {
  return repository.expirePendingBookings({
    now,
    holdDurationMs,
    offerDurationMs,
  });
}
