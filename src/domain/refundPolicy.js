import { DomainError } from './errors.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function toTimestamp(value, label) {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new DomainError('VALIDATION', `${label} must be a valid date`);
  }
  return timestamp;
}

export function calculateRefund({ amountCents, startsAt, now }) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new DomainError('VALIDATION', 'Amount must be a non-negative whole number of cents');
  }
  const startTime = toTimestamp(startsAt, 'Event start');
  const currentTime = toTimestamp(now, 'Current time');
  const timeUntilStart = startTime - currentTime;
  if (timeUntilStart <= 0) {
    throw new DomainError('EVENT_STARTED', 'The event has already started');
  }
  if (timeUntilStart >= 7 * DAY_MS) return amountCents;
  if (timeUntilStart >= 2 * DAY_MS) return Math.floor(amountCents / 2);
  return 0;
}
