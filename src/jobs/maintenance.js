import {
  BOOKING_HOLD_DURATION_MS,
  WAITLIST_OFFER_DURATION_MS,
  expireHeldBookings,
} from '../services/seatService.js';
import { systemClock } from '../lib/clock.js';

export async function runMaintenance({
  repository,
  clock = systemClock,
  holdDurationMs = BOOKING_HOLD_DURATION_MS,
  offerDurationMs = WAITLIST_OFFER_DURATION_MS,
} = {}) {
  if (!repository) throw new TypeError('A repository is required');
  const now = clock.now().toISOString();
  const expiredOffers = await repository.expireWaitlistOffers({ now, offerDurationMs });
  const expiredBookings = await expireHeldBookings(repository, {
    now,
    holdDurationMs,
    offerDurationMs,
  });
  return { expiredBookings, expiredOffers };
}
