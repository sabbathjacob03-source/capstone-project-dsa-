import { createSqliteRepository } from '../src/repositories/sqlite.js';
import * as bookingService from '../src/services/bookingService.js';
import * as eventService from '../src/services/eventService.js';

async function showUnsafeBaseline() {
  const capacity = 2;
  let sold = 1;
  const results = await Promise.all(Array.from({ length: 50 }, async () => {
    const sawASeat = sold < capacity;
    await Promise.resolve();
    if (sawASeat) sold += 1;
    return sawASeat;
  }));
  console.log(`Before fix (check-then-write): ${results.filter(Boolean).length} succeeded; ${sold}/${capacity} seats sold.`);
}

async function showAtomicResult() {
  const repository = createSqliteRepository({ databasePath: ':memory:' });
  try {
    const event = await eventService.createEvent(repository, 'demo-organizer', {
      title: 'Last Seat Demo',
      city: 'Lagos',
      startsAt: '2027-01-15T17:00:00.000Z',
    });
    const tier = await eventService.addTier(repository, event.id, {
      name: 'General admission',
      priceCents: 1000,
      capacity: 2,
    });
    await eventService.publishEvent(repository, event.id);
    await bookingService.bookTickets(repository, 'demo-attendee-0', {
      tierId: tier.id,
      quantity: 1,
    });

    const attempts = await Promise.all(Array.from({ length: 50 }, async (_, index) => {
      try {
        await bookingService.bookTickets(repository, `demo-attendee-${index + 1}`, {
          tierId: tier.id,
          quantity: 1,
        });
        return { status: 'fulfilled' };
      } catch (reason) {
        return { status: 'rejected', reason };
      }
    }));
    const succeeded = attempts.filter((attempt) => attempt.status === 'fulfilled').length;
    const soldOut = attempts.filter((attempt) =>
      attempt.status === 'rejected' && attempt.reason.code === 'SOLD_OUT',
    ).length;
    const tierAfter = await repository.tiers.findById(tier.id);
    console.log(`After fix (atomic SQLite reservation): ${succeeded} succeeded; ${soldOut} SOLD_OUT; ${tierAfter.sold}/${tierAfter.capacity} seats sold.`);
  } finally {
    repository.close();
  }
}

try {
  await showUnsafeBaseline();
  await showAtomicResult();
} catch (error) {
  console.error('Unable to run the oversell demo:', error);
  process.exitCode = 1;
}
