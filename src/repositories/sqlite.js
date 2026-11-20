import { DomainError } from '../domain/errors.js';
import { openDatabase } from '../db/connection.js';

function eventFromRow(row, tierRows) {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    title: row.title,
    city: row.city,
    venue: row.venue,
    startsAt: row.starts_at,
    status: row.status,
    tierIds: tierRows.filter((tier) => tier.event_id === row.id).map((tier) => tier.id),
  };
}

function tierFromRow(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    priceCents: row.price_cents,
    capacity: row.capacity,
    sold: row.sold,
  };
}

function bookingFromRow(row) {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    eventId: row.event_id,
    tierId: row.tier_id,
    quantity: row.quantity,
    amountCents: row.amount_cents,
    status: row.status,
    createdAt: row.created_at,
  };
}

function createCollection({ findById, findByReference, list, save }) {
  return Object.freeze({ findById, findByReference, list, save });
}

export function createSqliteRepository({ databasePath } = {}) {
  const database = openDatabase(databasePath);
  const eventById = database.prepare('SELECT * FROM events WHERE id = ?');
  const allEvents = database.prepare('SELECT * FROM events ORDER BY rowid');
  const tierIdsForEvents = database.prepare('SELECT id, event_id FROM ticket_tiers ORDER BY rowid');
  const tierById = database.prepare('SELECT * FROM ticket_tiers WHERE id = ?');
  const allTiers = database.prepare('SELECT * FROM ticket_tiers ORDER BY rowid');
  const bookingById = database.prepare('SELECT * FROM bookings WHERE id = ?');
  const bookingByReference = database.prepare('SELECT * FROM bookings WHERE reference = ?');
  const allBookings = database.prepare('SELECT * FROM bookings ORDER BY rowid');
  const ensureUser = database.prepare('INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)');

  const events = createCollection({
    findById(id) {
      const row = eventById.get(id);
      if (!row) return undefined;
      return eventFromRow(row, tierIdsForEvents.all());
    },
    findByReference() {
      return undefined;
    },
    list() {
      const tiers = tierIdsForEvents.all();
      return allEvents.all().map((row) => eventFromRow(row, tiers));
    },
    save(event) {
      ensureUser.run(event.organizerId, new Date().toISOString());
      database.prepare(`
        INSERT INTO events (id, organizer_id, title, city, venue, starts_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          organizer_id = excluded.organizer_id,
          title = excluded.title,
          city = excluded.city,
          venue = excluded.venue,
          starts_at = excluded.starts_at,
          status = excluded.status
      `).run(
        event.id,
        event.organizerId,
        event.title,
        event.city,
        event.venue,
        event.startsAt,
        event.status,
      );
      return event;
    },
  });

  const tiers = createCollection({
    findById(id) {
      const row = tierById.get(id);
      return row ? tierFromRow(row) : undefined;
    },
    findByReference() {
      return undefined;
    },
    list() {
      return allTiers.all().map(tierFromRow);
    },
    save(tier) {
      database.prepare(`
        INSERT INTO ticket_tiers (id, event_id, name, price_cents, capacity, sold)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          event_id = excluded.event_id,
          name = excluded.name,
          price_cents = excluded.price_cents,
          capacity = excluded.capacity,
          sold = excluded.sold
      `).run(tier.id, tier.eventId, tier.name, tier.priceCents, tier.capacity, tier.sold);
      return tier;
    },
  });

  const bookings = createCollection({
    findById(id) {
      const row = bookingById.get(id);
      return row ? bookingFromRow(row) : undefined;
    },
    findByReference(reference) {
      const row = bookingByReference.get(reference);
      return row ? bookingFromRow(row) : undefined;
    },
    list() {
      return allBookings.all().map(bookingFromRow);
    },
    save(booking) {
      ensureUser.run(booking.userId, new Date().toISOString());
      database.prepare(`
        INSERT INTO bookings (
          id, reference, user_id, event_id, tier_id, quantity, amount_cents, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          reference = excluded.reference,
          user_id = excluded.user_id,
          event_id = excluded.event_id,
          tier_id = excluded.tier_id,
          quantity = excluded.quantity,
          amount_cents = excluded.amount_cents,
          status = excluded.status,
          created_at = excluded.created_at
      `).run(
        booking.id,
        booking.reference,
        booking.userId,
        booking.eventId,
        booking.tierId,
        booking.quantity,
        booking.amountCents,
        booking.status,
        booking.createdAt,
      );
      return booking;
    },
  });

  return Object.freeze({
    events,
    tiers,
    bookings,
    reserveBooking(booking) {
      database.exec('BEGIN IMMEDIATE');
      try {
        ensureUser.run(booking.userId, new Date().toISOString());
        const reservation = database.prepare(`
          UPDATE ticket_tiers
          SET sold = sold + ?
          WHERE id = ? AND sold + ? <= capacity
        `).run(booking.quantity, booking.tierId, booking.quantity);
        if (Number(reservation.changes) === 0) {
          throw new DomainError('SOLD_OUT', 'The requested tickets are sold out');
        }
        bookings.save(booking);
        database.exec('COMMIT');
        return booking;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    countEvents() {
      return Number(database.prepare('SELECT COUNT(*) AS count FROM events').get().count);
    },
    close() {
      database.close();
    },
  });
}
