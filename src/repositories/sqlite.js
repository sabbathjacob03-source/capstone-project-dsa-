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
    holdExpiresAt: row.hold_expires_at,
    refundAmountCents: row.refund_amount_cents,
  };
}

function waitlistFromRow(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id,
    tierId: row.tier_id,
    createdAt: row.created_at,
    status: row.status,
    offerExpiresAt: row.offer_expires_at,
  };
}

function userFromRow(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
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
  const waitlistById = database.prepare('SELECT * FROM waitlist_entries WHERE id = ?');
  const allWaitlist = database.prepare('SELECT * FROM waitlist_entries ORDER BY rowid');
  const ensureUser = database.prepare('INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)');
  const userById = database.prepare('SELECT * FROM users WHERE id = ?');
  const userByEmail = database.prepare('SELECT * FROM users WHERE email = ?');
  const allUsers = database.prepare('SELECT * FROM users ORDER BY rowid');
  const saveUser = database.prepare(`
    INSERT INTO users (id, created_at, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      password_hash = excluded.password_hash,
      role = excluded.role
  `);
  const users = Object.freeze({
    findById(id) {
      return userFromRow(userById.get(id));
    },
    findByEmail(email) {
      return userFromRow(userByEmail.get(String(email).toLowerCase()));
    },
    list() {
      return allUsers.all().map(userFromRow);
    },
    save(user) {
      saveUser.run(
        user.id,
        user.createdAt,
        user.email.toLowerCase(),
        user.passwordHash,
        user.role,
      );
      return user;
    },
  });

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
          id, reference, user_id, event_id, tier_id, quantity, amount_cents, status, created_at,
          hold_expires_at, refund_amount_cents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          reference = excluded.reference,
          user_id = excluded.user_id,
          event_id = excluded.event_id,
          tier_id = excluded.tier_id,
          quantity = excluded.quantity,
          amount_cents = excluded.amount_cents,
          status = excluded.status,
          created_at = excluded.created_at,
          hold_expires_at = excluded.hold_expires_at,
          refund_amount_cents = excluded.refund_amount_cents
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
        booking.holdExpiresAt ?? null,
        booking.refundAmountCents ?? null,
      );
      return booking;
    },
  });

  const waitlist = Object.freeze({
    findById(id) {
      return waitlistFromRow(waitlistById.get(id));
    },
    list() {
      return allWaitlist.all().map(waitlistFromRow);
    },
    listOffersForUser(userId) {
      return database.prepare(`
        SELECT * FROM waitlist_entries
        WHERE user_id = ? AND status = 'offered'
        ORDER BY offer_expires_at, rowid
      `).all(userId).map(waitlistFromRow);
    },
    save(entry) {
      database.prepare(`
        INSERT INTO waitlist_entries (
          id, user_id, event_id, tier_id, created_at, status, offer_expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          offer_expires_at = excluded.offer_expires_at
      `).run(
        entry.id,
        entry.userId,
        entry.eventId,
        entry.tierId,
        entry.createdAt,
        entry.status,
        entry.offerExpiresAt ?? null,
      );
      return entry;
    },
  });

  function withTransaction(action) {
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      database.exec('COMMIT');
      return result;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  const setTierSold = database.prepare(`
    UPDATE ticket_tiers SET sold = sold + ?
    WHERE id = ? AND sold + ? >= 0 AND sold + ? <= capacity
  `);
  const waitingEntry = database.prepare(`
    SELECT * FROM waitlist_entries
    WHERE tier_id = ? AND status = 'waiting'
    ORDER BY created_at, rowid LIMIT 1
  `);
  const offerEntry = database.prepare(`
    UPDATE waitlist_entries SET status = 'offered', offer_expires_at = ?
    WHERE id = ? AND status = 'waiting'
  `);

  function offerFreedSeats(tierId, quantity, now, offerDurationMs) {
    let remaining = quantity;
    while (remaining > 0) {
      const entry = waitingEntry.get(tierId);
      if (!entry) break;
      const reserved = setTierSold.run(1, tierId, 1, 1);
      if (Number(reserved.changes) !== 1) break;
      const expiresAt = new Date(Date.parse(now) + offerDurationMs).toISOString();
      if (Number(offerEntry.run(expiresAt, entry.id).changes) !== 1) {
        throw new DomainError('INVALID_STATE', 'Waitlist entry changed while creating an offer');
      }
      remaining -= 1;
    }
  }

  function releaseInventoryAndOffer(booking, now, offerDurationMs) {
    const released = setTierSold.run(-booking.quantity, booking.tierId, -booking.quantity, -booking.quantity);
    if (Number(released.changes) !== 1) {
      throw new DomainError('INVALID_STATE', 'Releasing this booking would make sold inventory invalid');
    }
    offerFreedSeats(booking.tierId, booking.quantity, now, offerDurationMs);
  }

  const saveBookingStatus = database.prepare(`
    UPDATE bookings SET status = ?, refund_amount_cents = ?
    WHERE reference = ? AND user_id = ? AND status = ?
  `);

  return Object.freeze({
    events,
    tiers,
    bookings,
    waitlist,
    users,
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
    joinWaitlist(entry) {
      return withTransaction(() => {
        const tier = tierById.get(entry.tierId);
        if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');
        if (tier.sold < tier.capacity) {
          throw new DomainError('NOT_SOLD_OUT', 'You can only join a waitlist for a sold-out tier');
        }
        const duplicate = database.prepare(`
          SELECT id FROM waitlist_entries
          WHERE tier_id = ? AND user_id = ? AND status IN ('waiting', 'offered')
        `).get(entry.tierId, entry.userId);
        if (duplicate) {
          throw new DomainError('ALREADY_ON_WAITLIST', 'You are already on this waitlist');
        }
        ensureUser.run(entry.userId, entry.createdAt);
        waitlist.save(entry);
        return entry;
      });
    },
    claimBookingStatus(reference, userId, expectedStatus, nextStatus) {
      const result = saveBookingStatus.run(nextStatus, null, reference, userId, expectedStatus);
      if (Number(result.changes) !== 1) return undefined;
      return bookingFromRow(bookingByReference.get(reference));
    },
    restoreRefundClaim(reference, userId) {
      const result = saveBookingStatus.run('paid', null, reference, userId, 'refunding');
      return Number(result.changes) === 1;
    },
    cancelBookingAndRelease({ reference, userId, expectedStatus, nextStatus, now, offerDurationMs, refundAmountCents = null }) {
      return withTransaction(() => {
        const result = saveBookingStatus.run(
          nextStatus,
          refundAmountCents,
          reference,
          userId,
          expectedStatus,
        );
        if (Number(result.changes) !== 1) return undefined;
        const booking = bookingFromRow(bookingByReference.get(reference));
        releaseInventoryAndOffer(booking, now, offerDurationMs);
        return booking;
      });
    },
    completeRefund({ reference, userId, now, offerDurationMs, refundAmountCents }) {
      return withTransaction(() => {
        const result = saveBookingStatus.run(
          'refunded',
          refundAmountCents,
          reference,
          userId,
          'refunding',
        );
        if (Number(result.changes) !== 1) return undefined;
        const booking = bookingFromRow(bookingByReference.get(reference));
        releaseInventoryAndOffer(booking, now, offerDurationMs);
        return booking;
      });
    },
    expirePendingBookings({ now, holdDurationMs, offerDurationMs }) {
      return withTransaction(() => {
        let expiredCount = 0;
        for (const row of allBookings.all()) {
          const booking = bookingFromRow(row);
          if (booking.status !== 'pending') continue;
          const expiresAt = booking.holdExpiresAt ??
            new Date(Date.parse(booking.createdAt) + holdDurationMs).toISOString();
          if (Date.parse(expiresAt) > Date.parse(now)) continue;
          const result = saveBookingStatus.run(
            'cancelled',
            null,
            booking.reference,
            booking.userId,
            'pending',
          );
          if (Number(result.changes) !== 1) continue;
          releaseInventoryAndOffer(booking, now, offerDurationMs);
          expiredCount += 1;
        }
        return expiredCount;
      });
    },
    expireWaitlistOffers({ now, offerDurationMs }) {
      return withTransaction(() => {
        let expiredCount = 0;
        const nowTime = Date.parse(now);
        const expiredOffers = database.prepare(`
          SELECT * FROM waitlist_entries
          WHERE status = 'offered' AND offer_expires_at <= ?
          ORDER BY offer_expires_at, rowid
        `).all(now);
        for (const row of expiredOffers) {
          if (Date.parse(row.offer_expires_at) > nowTime) continue;
          const result = database.prepare(`
            UPDATE waitlist_entries SET status = 'expired'
            WHERE id = ? AND status = 'offered' AND offer_expires_at <= ?
          `).run(row.id, now);
          if (Number(result.changes) !== 1) continue;
          releaseInventoryAndOffer({
            tierId: row.tier_id,
            quantity: 1,
          }, now, offerDurationMs);
          expiredCount += 1;
        }
        return expiredCount;
      });
    },
    acceptWaitlistOffer({ id, userId, now, booking, offerDurationMs }) {
      return withTransaction(() => {
        const entry = waitlistById.get(id);
        if (!entry || entry.user_id !== userId) {
          return { notFound: true };
        }
        if (entry.status !== 'offered') return { invalid: true };
        if (Date.parse(entry.offer_expires_at) <= Date.parse(now)) {
          const expired = database.prepare(`
            UPDATE waitlist_entries SET status = 'expired'
            WHERE id = ? AND status = 'offered'
          `).run(id);
          if (Number(expired.changes) === 1) {
            releaseInventoryAndOffer({ tierId: entry.tier_id, quantity: 1 }, now, offerDurationMs);
          }
          return { expired: true };
        }
        const accepted = database.prepare(`
          UPDATE waitlist_entries SET status = 'accepted', offer_expires_at = NULL
          WHERE id = ? AND user_id = ? AND status = 'offered'
        `).run(id, userId);
        if (Number(accepted.changes) !== 1) return { invalid: true };
        ensureUser.run(booking.userId, booking.createdAt);
        bookings.save(booking);
        return { booking };
      });
    },
    countEvents() {
      return Number(database.prepare('SELECT COUNT(*) AS count FROM events').get().count);
    },
    close() {
      database.close();
    },
  });
}
