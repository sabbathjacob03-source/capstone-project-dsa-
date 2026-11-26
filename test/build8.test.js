import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { calculateRefund } from '../src/domain/refundPolicy.js';
import { createClock } from '../src/lib/clock.js';
import { createMemoryRepository } from '../src/repositories/memory.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { BOOKING_HOLD_DURATION_MS, WAITLIST_OFFER_DURATION_MS } from '../src/services/seatService.js';
import * as bookingService from '../src/services/bookingService.js';
import * as eventService from '../src/services/eventService.js';
import * as waitlistService from '../src/services/waitlistService.js';
import { runMaintenance } from '../src/jobs/maintenance.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Build 8 refund policy', () => {
  const now = new Date('2026-11-26T12:00:00.000Z');

  it('applies full, half, and zero refunds at the exact boundaries', () => {
    const refund = (days, hours = 0) => calculateRefund({
      amountCents: 101,
      startsAt: new Date(now.getTime() + days * DAY_MS + hours * 60 * 60 * 1000),
      now,
    });

    assert.equal(refund(7), 101);
    assert.equal(refund(6, 23), 50);
    assert.equal(refund(2), 50);
    assert.equal(refund(1, 23), 0);
  });

  it('rejects events that have started and invalid cent amounts', () => {
    assert.throws(
      () => calculateRefund({ amountCents: 100, startsAt: now, now }),
      (error) => error.code === 'EVENT_STARTED',
    );
    assert.throws(
      () => calculateRefund({
        amountCents: 1.5,
        startsAt: new Date(now.getTime() + DAY_MS),
        now,
      }),
      (error) => error.code === 'VALIDATION',
    );
  });
});

async function createFixture(time, capacity = 1) {
  const repository = createMemoryRepository();
  const clock = createClock(() => time.current);
  const event = await eventService.createEvent(repository, 'organizer-1', {
    title: 'Build 8 Event',
    city: 'Lagos',
    venue: 'Yaba Hub',
    startsAt: new Date(time.current.getTime() + 30 * DAY_MS).toISOString(),
  });
  const tier = await eventService.addTier(repository, event.id, 'organizer-1', {
    name: 'General',
    priceCents: 101,
    capacity,
  });
  await eventService.publishEvent(repository, event.id);
  return { repository, clock, event, tier };
}

async function createSqliteFixture(repository, now) {
  const event = await eventService.createEvent(repository, 'organizer-migrated', {
    title: 'Migrated Event',
    city: 'Lagos',
    startsAt: new Date(now.getTime() + 30 * DAY_MS).toISOString(),
  });
  const tier = await eventService.addTier(repository, event.id, 'organizer-migrated', {
    name: 'General',
    priceCents: 500,
    capacity: 1,
  });
  await eventService.publishEvent(repository, event.id);
  return { event, tier };
}

describe('Build 8 bookings and waitlist', () => {
  it('migrates an existing bookings table for Build 8 fields and states', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ticketing-build8-'));
    const databasePath = join(directory, 'legacy.sqlite');
    const legacy = new DatabaseSync(databasePath);
    legacy.exec(`
      CREATE TABLE bookings (
        id TEXT PRIMARY KEY,
        reference TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        tier_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        amount_cents INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded', 'checked_in')),
        created_at TEXT NOT NULL
      )
    `);
    legacy.close();
    const repository = createSqliteRepository({ databasePath });
    try {
      const time = { current: new Date('2026-11-26T12:00:00.000Z') };
      const { event, tier } = await createSqliteFixture(repository, time.current);
      const booking = await bookingService.bookTickets(
        repository,
        'attendee-migrated',
        { tierId: tier.id, quantity: 1 },
        createClock(() => time.current),
      );
      assert.equal(booking.status, 'pending');
      assert.ok(booking.holdExpiresAt);
      const claimed = await repository.claimBookingStatus(
        booking.reference,
        booking.userId,
        'pending',
        'payment_processing',
      );
      assert.equal(claimed.status, 'payment_processing');
      assert.equal((await repository.events.findById(event.id)).id, event.id);
    } finally {
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps waitlist seat holds and acceptance atomic in SQLite', async () => {
    const repository = createSqliteRepository({ databasePath: ':memory:' });
    try {
      const time = { current: new Date('2026-11-26T12:00:00.000Z') };
      const clock = createClock(() => time.current);
      const event = await eventService.createEvent(repository, 'organizer-sqlite', {
        title: 'SQLite Waitlist Event',
        city: 'Lagos',
        startsAt: new Date(time.current.getTime() + 30 * DAY_MS).toISOString(),
      });
      const tier = await eventService.addTier(repository, event.id, 'organizer-sqlite', {
        name: 'General',
        priceCents: 500,
        capacity: 1,
      });
      await eventService.publishEvent(repository, event.id);
      const booking = await bookingService.bookTickets(
        repository,
        'attendee-sqlite-holder',
        { tierId: tier.id, quantity: 1 },
        clock,
      );
      const entry = await waitlistService.joinWaitlist(
        repository,
        'attendee-sqlite-waiter',
        { tierId: tier.id },
        clock,
      );
      const cancellations = await Promise.allSettled([
        bookingService.cancelBooking(
          repository,
          'attendee-sqlite-holder',
          booking.reference,
          undefined,
          clock,
        ),
        bookingService.cancelBooking(
          repository,
          'attendee-sqlite-holder',
          booking.reference,
          undefined,
          clock,
        ),
      ]);
      assert.equal(cancellations.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(cancellations.filter((result) => result.status === 'rejected').length, 1);
      assert.equal((await repository.waitlist.findById(entry.id)).status, 'offered');
      assert.equal((await repository.tiers.findById(tier.id)).sold, 1);
      const accepted = await waitlistService.acceptOffer(
        repository,
        'attendee-sqlite-waiter',
        entry.id,
        clock,
      );
      assert.equal(accepted.status, 'pending');
      assert.equal((await repository.bookings.findByReference(accepted.reference)).status, 'pending');
      assert.equal((await repository.tiers.findById(tier.id)).sold, 1);
    } finally {
      repository.close();
    }
  });

  it('refunds once, releases inventory once, and offers the seat to the first waiter', async () => {
    const time = { current: new Date('2026-11-26T12:00:00.000Z') };
    const { repository, clock, tier } = await createFixture(time);
    const booking = await bookingService.bookTickets(
      repository,
      'attendee-holder',
      { tierId: tier.id, quantity: 1 },
      clock,
    );
    await bookingService.payBooking(
      repository,
      'attendee-holder',
      booking.reference,
      {},
      async () => ({ status: 'succeeded' }),
      clock,
    );
    const first = await waitlistService.joinWaitlist(repository, 'attendee-first', {
      tierId: tier.id,
    }, clock);
    await waitlistService.joinWaitlist(repository, 'attendee-second', {
      tierId: tier.id,
    }, clock);
    const refunds = [];
    const refundGateway = async (request) => {
      refunds.push(request);
      return { status: 'succeeded' };
    };

    const cancellations = await Promise.allSettled([
      bookingService.cancelBooking(
        repository,
        'attendee-holder',
        booking.reference,
        refundGateway,
        clock,
      ),
      bookingService.cancelBooking(
        repository,
        'attendee-holder',
        booking.reference,
        refundGateway,
        clock,
      ),
    ]);
    const successfulCancellations = cancellations.filter((result) => result.status === 'fulfilled');
    assert.equal(successfulCancellations.length, 1);
    assert.equal(cancellations.filter((result) => result.status === 'rejected').length, 1);
    const refunded = successfulCancellations[0].value;
    assert.equal(refunded.status, 'refunded');
    assert.equal(refunded.refundAmountCents, 101);
    assert.deepEqual(refunds, [{ amountCents: 101, reference: booking.reference }]);
    assert.equal((await repository.tiers.findById(tier.id)).sold, 1);
    assert.equal((await repository.waitlist.findById(first.id)).status, 'offered');

    await assert.rejects(
      bookingService.cancelBooking(
        repository,
        'attendee-holder',
        booking.reference,
        refundGateway,
        clock,
      ),
      (error) => error.code === 'INVALID_STATE',
    );
    assert.equal(refunds.length, 1);
    assert.equal((await repository.tiers.findById(tier.id)).sold, 1);
  });

  it('expires SQLite holds and offers, handing the seat to the next attendee', async () => {
    const repository = createSqliteRepository({ databasePath: ':memory:' });
    try {
      const time = { current: new Date('2026-11-26T12:00:00.000Z') };
      const clock = createClock(() => time.current);
      const { tier } = await createSqliteFixture(repository, time.current);
      const booking = await bookingService.bookTickets(
        repository,
        'attendee-sqlite-holder',
        { tierId: tier.id, quantity: 1 },
        clock,
      );
      const first = await waitlistService.joinWaitlist(
        repository,
        'attendee-sqlite-first',
        { tierId: tier.id },
        clock,
      );
      const second = await waitlistService.joinWaitlist(
        repository,
        'attendee-sqlite-second',
        { tierId: tier.id },
        clock,
      );

      time.current = new Date(time.current.getTime() + BOOKING_HOLD_DURATION_MS + 1);
      assert.deepEqual(await runMaintenance({ repository, clock }), {
        expiredBookings: 1,
        expiredOffers: 0,
      });
      assert.equal((await repository.waitlist.findById(first.id)).status, 'offered');
      assert.equal((await repository.bookings.findByReference(booking.reference)).status, 'cancelled');

      time.current = new Date(time.current.getTime() + WAITLIST_OFFER_DURATION_MS);
      assert.deepEqual(await runMaintenance({ repository, clock }), {
        expiredBookings: 0,
        expiredOffers: 1,
      });
      assert.equal((await repository.waitlist.findById(first.id)).status, 'expired');
      assert.equal((await repository.waitlist.findById(second.id)).status, 'offered');
      assert.equal((await repository.tiers.findById(tier.id)).sold, 1);
      await assert.rejects(
        waitlistService.acceptOffer(repository, 'attendee-sqlite-first', first.id, clock),
        (error) => error.code === 'OFFER_EXPIRED',
      );
    } finally {
      repository.close();
    }
  });

  it('expires an offer and passes its held seat to the next waiter', async () => {
    const time = { current: new Date('2026-11-26T12:00:00.000Z') };
    const { repository, clock, tier } = await createFixture(time);
    const heldBooking = await bookingService.bookTickets(
      repository,
      'attendee-holder',
      { tierId: tier.id, quantity: 1 },
      clock,
    );
    const first = await waitlistService.joinWaitlist(repository, 'attendee-first', {
      tierId: tier.id,
    }, clock);
    const second = await waitlistService.joinWaitlist(repository, 'attendee-second', {
      tierId: tier.id,
    }, clock);
    await bookingService.cancelBooking(repository, 'attendee-holder', heldBooking.reference, undefined, clock);

    time.current = new Date(time.current.getTime() + WAITLIST_OFFER_DURATION_MS);
    await assert.rejects(
      waitlistService.acceptOffer(repository, 'attendee-first', first.id, clock),
      (error) => error.code === 'OFFER_EXPIRED',
    );
    assert.equal((await repository.waitlist.findById(first.id)).status, 'expired');
    assert.equal((await repository.waitlist.findById(second.id)).status, 'offered');
    assert.equal((await repository.tiers.findById(tier.id)).sold, 1);

    const accepted = await waitlistService.acceptOffer(repository, 'attendee-second', second.id, clock);
    assert.equal(accepted.status, 'pending');
    assert.equal(accepted.quantity, 1);
    assert.equal((await repository.tiers.findById(tier.id)).sold, 1);
  });

  it('expires unpaid holds, releases inventory, and rejects later payment', async () => {
    const time = { current: new Date('2026-11-26T12:00:00.000Z') };
    const { repository, clock, tier } = await createFixture(time);
    const booking = await bookingService.bookTickets(
      repository,
      'attendee-holder',
      { tierId: tier.id, quantity: 1 },
      clock,
    );
    time.current = new Date(time.current.getTime() + BOOKING_HOLD_DURATION_MS + 1);

    assert.deepEqual(await runMaintenance({ repository, clock }), {
      expiredBookings: 1,
      expiredOffers: 0,
    });
    assert.equal((await repository.bookings.findByReference(booking.reference)).status, 'cancelled');
    assert.equal((await repository.tiers.findById(tier.id)).sold, 0);
    await assert.rejects(
      bookingService.payBooking(repository, 'attendee-holder', booking.reference, {}, undefined, clock),
      (error) => error.code === 'BOOKING_EXPIRED',
    );
  });

  it('rejects joining a tier that still has seats', async () => {
    const { repository, clock, tier } = await createFixture({
      current: new Date('2026-11-26T12:00:00.000Z'),
    }, 2);
    await assert.rejects(
      waitlistService.joinWaitlist(repository, 'attendee-1', { tierId: tier.id }, clock),
      (error) => error.code === 'NOT_SOLD_OUT',
    );
  });
});
