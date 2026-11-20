import { createSqliteRepository } from '../src/repositories/sqlite.js';
import * as eventService from '../src/services/eventService.js';

const repository = createSqliteRepository();

try {
  if (repository.countEvents() > 0) {
    console.log('Database already contains event data; seed skipped.');
  } else {
    const event = await eventService.createEvent(repository, 'seed-organizer', {
      title: 'Lagos Tech Meetup',
      city: 'Lagos',
      venue: 'Yaba Hub',
      startsAt: '2027-01-15T17:00:00.000Z',
    });
    await eventService.addTier(repository, event.id, {
      name: 'General admission',
      priceCents: 5000,
      capacity: 100,
    });
    await eventService.publishEvent(repository, event.id);
    console.log('Seeded the database with one published event and its ticket tier.');
  }
} catch (error) {
  console.error('Unable to seed the database:', error);
  process.exitCode = 1;
} finally {
  repository.close();
}
