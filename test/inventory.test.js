import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../src/domain/errors.js';
import { addTier, createEvent, createStore, listEventSummaries, publishEvent } from '../src/domain/inventory.js';

const codeIs = (code) => (error) => error instanceof DomainError && error.code === code;

describe('event publishing and summaries', () => {
  it('rejects publishing an event without ticket tiers using INVALID_STATE', () => {
    const store = createStore();
    const event = createEvent(store, {
      title: 'No tickets',
      city: 'Lagos',
      startsAt: '2026-12-05T17:00:00Z',
    });
    assert.throws(() => publishEvent(store, event.id), codeIs('INVALID_STATE'));
    assert.equal(event.status, 'draft');
  });

  it('publishes an event that has at least one tier', () => {
    const store = createStore();
    const event = createEvent(store, {
      title: 'Ticketed event',
      city: 'Lagos',
      startsAt: '2026-12-05T17:00:00Z',
    });
    addTier(store, event.id, { name: 'General', priceCents: 500, capacity: 10 });
    assert.equal(publishEvent(store, event.id).status, 'published');
  });

  it('hides drafts from public summaries and includes them when requested', () => {
    const store = createStore();
    const draft = createEvent(store, {
      title: 'Draft event',
      city: 'Lagos',
      startsAt: '2026-12-05T17:00:00Z',
    });
    const published = createEvent(store, {
      title: 'Published event',
      city: 'Abuja',
      startsAt: '2026-12-06T17:00:00Z',
    });
    addTier(store, published.id, { name: 'General', priceCents: 500, capacity: 10 });
    publishEvent(store, published.id);

    assert.deepEqual(listEventSummaries(store).map((summary) => summary.id), [published.id]);
    assert.deepEqual(
      listEventSummaries(store, { publishedOnly: false }).map((summary) => summary.id),
      [draft.id, published.id],
    );
  });

  it('reports cheapest tier price and total seats left in a summary', () => {
    const store = createStore();
    const event = createEvent(store, {
      title: 'Multiple tiers',
      city: 'Lagos',
      startsAt: '2026-12-05T17:00:00Z',
    });
    addTier(store, event.id, { name: 'Balcony', priceCents: 800, capacity: 3 });
    addTier(store, event.id, { name: 'General', priceCents: 500, capacity: 7 });
    publishEvent(store, event.id);
    const [summary] = listEventSummaries(store);
    assert.equal(summary.minPriceCents, 500);
    assert.equal(summary.seatsLeft, 10);
  });

  it('reports invalid stores, IDs, and list options with stable error codes', () => {
    assert.throws(() => listEventSummaries(null), codeIs('VALIDATION'));
    assert.throws(() => publishEvent(createStore(), 'missing'), codeIs('NOT_FOUND'));
    assert.throws(() => listEventSummaries(createStore(), { publishedOnly: 1 }), codeIs('VALIDATION'));
  });
});
