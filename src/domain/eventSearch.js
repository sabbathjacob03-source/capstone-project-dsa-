import { DomainError } from './errors.js';
import { mergeSort } from './sorting.js';

function requireSummaries(summaries) {
  if (!Array.isArray(summaries)) {
    throw new DomainError('VALIDATION', 'Event summaries must be an array');
  }
  for (const summary of summaries) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
      throw new DomainError('VALIDATION', 'Each event summary must be an object');
    }
  }
}

function requireCriteria(criteria) {
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) {
    throw new DomainError('VALIDATION', 'Search criteria must be an object');
  }
}

function validDate(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${label} must be a valid date`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError('VALIDATION', `${label} must be a valid date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && date.toISOString().slice(0, 10) !== value) {
    throw new DomainError('VALIDATION', `${label} must be a valid date`);
  }
  return date;
}

function readPrice(summary) {
  if (summary.minPriceCents !== undefined) return summary.minPriceCents;
  if (summary.cheapestPriceCents !== undefined) return summary.cheapestPriceCents;
  if (summary.priceCents !== undefined) return summary.priceCents;
  return null;
}

function readSeatsLeft(summary) {
  if (summary.seatsLeft !== undefined) return summary.seatsLeft;
  if (summary.availableTickets !== undefined) return summary.availableTickets;
  return 0;
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareTitleThenId(left, right) {
  return compareText(String(left.title ?? ''), String(right.title ?? '')) ||
    compareText(String(left.id ?? ''), String(right.id ?? ''));
}

export function filterEvents(summaries, criteria = {}) {
  requireSummaries(summaries);
  requireCriteria(criteria);

  const { q, city, from, to, maxPriceCents, onlyAvailable } = criteria;
  if (q !== undefined && typeof q !== 'string') {
    throw new DomainError('VALIDATION', 'Search query must be a string');
  }
  if (city !== undefined && typeof city !== 'string') {
    throw new DomainError('VALIDATION', 'City must be a string');
  }
  const fromDate = from === undefined ? null : validDate(from, 'From date');
  let toDate = to === undefined ? null : validDate(to, 'To date');
  if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    toDate = new Date(toDate.getTime() + 86_399_999);
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new DomainError('VALIDATION', 'From date must not be after to date');
  }
  if (
    maxPriceCents !== undefined &&
    (!Number.isSafeInteger(maxPriceCents) || maxPriceCents < 0)
  ) {
    throw new DomainError('VALIDATION', 'Maximum price must be a non-negative whole number of cents');
  }
  if (onlyAvailable !== undefined && typeof onlyAvailable !== 'boolean') {
    throw new DomainError('VALIDATION', 'onlyAvailable must be a boolean');
  }

  const query = q?.trim().toLowerCase();
  const normalizedCity = city?.trim().toLowerCase();
  return summaries.filter((summary) => {
    if (
      query &&
      !String(summary.title ?? '').toLowerCase().includes(query) &&
      !String(summary.venue ?? '').toLowerCase().includes(query)
    ) {
      return false;
    }
    if (normalizedCity && String(summary.city ?? '').trim().toLowerCase() !== normalizedCity) {
      return false;
    }

    if (fromDate || toDate) {
      const startsAt = validDate(summary.startsAt, 'Event start time');
      if (fromDate && startsAt < fromDate) return false;
      if (toDate && startsAt > toDate) return false;
    }

    if (maxPriceCents !== undefined) {
      const price = readPrice(summary);
      if (price === null || price === undefined) return false;
      if (!Number.isSafeInteger(price) || price < 0) {
        throw new DomainError('VALIDATION', 'Cheapest event price must be a non-negative whole number');
      }
      if (price > maxPriceCents) return false;
    }

    if (onlyAvailable && readSeatsLeft(summary) <= 0) return false;
    return true;
  });
}

export function sortEvents(summaries, sortBy = 'date') {
  requireSummaries(summaries);
  if (!['date', 'price', 'availability'].includes(sortBy)) {
    throw new DomainError('VALIDATION', `Unknown event sort: ${sortBy}`);
  }

  const compare = (left, right) => {
    let order = 0;
    if (sortBy === 'date') {
      order = validDate(left.startsAt, 'Event start time') - validDate(right.startsAt, 'Event start time');
    } else if (sortBy === 'price') {
      const leftPrice = readPrice(left);
      const rightPrice = readPrice(right);
      if (leftPrice == null && rightPrice != null) order = 1;
      else if (leftPrice != null && rightPrice == null) order = -1;
      else if (leftPrice != null && rightPrice != null) {
        if (!Number.isSafeInteger(leftPrice) || leftPrice < 0 ||
            !Number.isSafeInteger(rightPrice) || rightPrice < 0) {
          throw new DomainError('VALIDATION', 'Event prices must be non-negative whole numbers of cents');
        }
        order = leftPrice - rightPrice;
      }
    } else {
      const leftSeats = readSeatsLeft(left);
      const rightSeats = readSeatsLeft(right);
      if (!Number.isSafeInteger(leftSeats) || leftSeats < 0 ||
          !Number.isSafeInteger(rightSeats) || rightSeats < 0) {
        throw new DomainError('VALIDATION', 'Available seats must be a non-negative whole number');
      }
      order = rightSeats - leftSeats;
    }
    return order || compareTitleThenId(left, right);
  };

  return mergeSort(summaries, compare);
}

export function searchEvents(summaries, criteria = {}, sortBy = 'date') {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}
