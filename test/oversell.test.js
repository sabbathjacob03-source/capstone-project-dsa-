import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import * as bookingService from '../src/services/bookingService.js';
import * as eventService from '../src/services/eventService.js';

describe('SQLite booking capacity', () => {
  let repository;
  let tier;

  before(async () => {
    repository = createSqliteRepository({ databasePath: ':memory:' });
    const event = await eventService.createEvent(repository, 'organizer-1', {
      title: 'One Seat Event',
      city: 'Lagos',
      startsAt: '2027-01-15T17:00:00.000Z',
    });
    tier = await eventService.addTier(repository, event.id, {
      name: 'General admission',
      priceCents: 1000,
      capacity: 2,
    });
    await eventService.publishEvent(repository, event.id);
    await bookingService.bookTickets(repository, 'attendee-existing', {
      tierId: tier.id,
      quantity: 1,
    });
  });

  after(() => {
    repository.close();
  });

  it('allows exactly one of 50 simultaneous requests for the last seat', async () => {
    const attempts = await Promise.all(Array.from({ length: 50 }, async (_, index) => {
      try {
        await bookingService.bookTickets(repository, `attendee-${index}`, {
          tierId: tier.id,
          quantity: 1,
        });
        return { status: 'fulfilled' };
      } catch (reason) {
        return { status: 'rejected', reason };
      }
    }));
    const succeeded = attempts.filter((attempt) => attempt.status === 'fulfilled');
    const rejected = attempts.filter((attempt) => attempt.status === 'rejected');

    assert.equal(succeeded.length, 1);
    assert.equal(rejected.length, 49);
    assert.ok(rejected.every((attempt) => attempt.reason.code === 'SOLD_OUT'));
    assert.equal((await repository.tiers.findById(tier.id)).sold, 2);
    assert.equal((await repository.bookings.list()).length, 2);
  });
});
