import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../src/domain/errors.js';
import { filterEvents, searchEvents, sortEvents } from '../src/domain/eventSearch.js';

const events = [
  {
    id: 'evt-c',
    title: 'Gamma Concert',
    city: 'Lagos',
    venue: 'Civic Hall',
    startsAt: '2026-06-30T23:59:59.999Z',
    minPriceCents: 5000,
    seatsLeft: 0,
  },
  {
    id: 'evt-a',
    title: 'Alpha Meetup',
    city: 'Abuja',
    venue: 'Tech Loft',
    startsAt: '2026-06-01T10:00:00.000Z',
    minPriceCents: 0,
    seatsLeft: 12,
  },
  {
    id: 'evt-b',
    title: 'Beta Concert',
    city: 'Lagos',
    venue: 'Open Arena',
    startsAt: '2026-06-15T12:00:00.000Z',
    minPriceCents: 2500,
    seatsLeft: 4,
  },
  {
    id: 'evt-no-price',
    title: 'Community Gathering',
    city: 'Lagos',
    venue: 'Library',
    startsAt: '2026-06-15T12:00:00.000Z',
    minPriceCents: null,
    seatsLeft: 0,
  },
];

const cloneEvents = () => events.map((event) => ({ ...event }));
const codeIs = (code) => (error) => error instanceof DomainError && error.code === code;

describe('filterEvents', () => {
  it('matches query text in title or venue, ignoring case', () => {
    assert.deepEqual(filterEvents(events, { q: 'cOnCeRt' }).map((event) => event.id), ['evt-c', 'evt-b']);
    assert.deepEqual(filterEvents(events, { q: 'TECH LOFT' }).map((event) => event.id), ['evt-a']);
  });

  it('matches the whole city name, ignoring case', () => {
    assert.deepEqual(filterEvents(events, { city: 'lAgOs' }).map((event) => event.id), [
      'evt-c', 'evt-b', 'evt-no-price',
    ]);
    assert.deepEqual(filterEvents(events, { city: 'lag' }), []);
  });

  it('uses inclusive from and to dates, including all of a date-only to day', () => {
    assert.deepEqual(
      filterEvents(events, { from: '2026-06-01', to: '2026-06-30' }).map((event) => event.id),
      ['evt-c', 'evt-a', 'evt-b', 'evt-no-price'],
    );
    assert.deepEqual(
      filterEvents(events, { from: '2026-06-15T12:00:00.000Z' }).map((event) => event.id),
      ['evt-c', 'evt-b', 'evt-no-price'],
    );
  });

  it('filters by cheapest tier price and excludes events without tiers', () => {
    assert.deepEqual(
      filterEvents(events, { maxPriceCents: 2500 }).map((event) => event.id),
      ['evt-a', 'evt-b'],
    );
  });

  it('filters for events with tickets available', () => {
    assert.deepEqual(filterEvents(events, { onlyAvailable: true }).map((event) => event.id), [
      'evt-a', 'evt-b',
    ]);
  });

  it('returns a new list and does not change the original list or entries', () => {
    const input = cloneEvents();
    const before = input.map((event) => ({ ...event }));
    const result = filterEvents(input, { city: 'Lagos' });
    assert.notEqual(result, input);
    assert.deepEqual(input, before);
  });

  it('returns an empty list for empty input', () => {
    assert.deepEqual(filterEvents([], { q: 'no match' }), []);
  });

  it('reports invalid dates, reversed ranges, and non-whole prices as VALIDATION', () => {
    assert.throws(() => filterEvents(events, { from: 'not-a-date' }), codeIs('VALIDATION'));
    assert.throws(() => filterEvents(events, { to: '2026-02-30' }), codeIs('VALIDATION'));
    assert.throws(
      () => filterEvents(events, { from: '2026-07-01', to: '2026-06-30' }),
      codeIs('VALIDATION'),
    );
    assert.throws(() => filterEvents(events, { maxPriceCents: 1.5 }), codeIs('VALIDATION'));
    assert.throws(() => filterEvents(events, { maxPriceCents: -1 }), codeIs('VALIDATION'));
    assert.throws(() => filterEvents(events, { onlyAvailable: 'yes' }), codeIs('VALIDATION'));
  });
});

describe('sortEvents', () => {
  it('sorts by date, earliest first, breaking ties by title and id', () => {
    const input = cloneEvents();
    const result = sortEvents(input, 'date');
    assert.deepEqual(result.map((event) => event.id), ['evt-a', 'evt-b', 'evt-no-price', 'evt-c']);
    assert.deepEqual(input, cloneEvents());
    assert.notEqual(result, input);
  });

  it('sorts by cheapest price first and puts events with no price last', () => {
    assert.deepEqual(sortEvents(events, 'price').map((event) => event.id), [
      'evt-a', 'evt-b', 'evt-c', 'evt-no-price',
    ]);
  });

  it('sorts by available seats descending, then title and id', () => {
    assert.deepEqual(sortEvents(events, 'availability').map((event) => event.id), [
      'evt-a', 'evt-b', 'evt-no-price', 'evt-c',
    ]);
  });

  it('uses id to break ties when titles match', () => {
    const tied = [
      { ...events[0], id: 'z', title: 'Same' },
      { ...events[1], id: 'a', title: 'Same' },
    ];
    assert.deepEqual(sortEvents(tied, 'date').map((event) => event.id), ['a', 'z']);
  });

  it('rejects unknown sort keys with VALIDATION', () => {
    assert.throws(() => sortEvents(events, 'random'), codeIs('VALIDATION'));
  });

  it('returns an empty list for empty input', () => {
    assert.deepEqual(sortEvents([], 'price'), []);
  });
});

describe('searchEvents', () => {
  it('filters first and then sorts the matches', () => {
    assert.deepEqual(
      searchEvents(events, { city: 'Lagos', onlyAvailable: true }, 'price').map((event) => event.id),
      ['evt-b'],
    );
  });

  it('rejects malformed search criteria and non-array input with VALIDATION', () => {
    assert.throws(() => filterEvents(events, null), codeIs('VALIDATION'));
    assert.throws(() => filterEvents({}, {}), codeIs('VALIDATION'));
    assert.throws(() => filterEvents(events, { q: 42 }), codeIs('VALIDATION'));
  });
});
