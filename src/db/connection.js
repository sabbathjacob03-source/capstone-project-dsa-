import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA_PATH = fileURLToPath(new URL('./schema.sql', import.meta.url));
export const DEFAULT_DATABASE_PATH = resolve(fileURLToPath(new URL('../../data/ticketing.sqlite', import.meta.url)));

export function openDatabase(databasePath = DEFAULT_DATABASE_PATH) {
  if (databasePath !== ':memory:') mkdirSync(dirname(resolve(databasePath)), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  const bookingDefinition = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bookings'",
  ).get().sql;
  if (!bookingDefinition.includes("'refunding'") || !bookingDefinition.includes("'payment_processing'")) {
    database.exec('PRAGMA foreign_keys = OFF');
    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec(`
        ALTER TABLE bookings RENAME TO bookings_before_build8;
        CREATE TABLE bookings (
          id TEXT PRIMARY KEY,
          reference TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          tier_id TEXT NOT NULL,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
          status TEXT NOT NULL CHECK (status IN ('pending', 'payment_processing', 'paid', 'refunding', 'cancelled', 'refunded', 'checked_in')),
          created_at TEXT NOT NULL,
          hold_expires_at TEXT,
          refund_amount_cents INTEGER CHECK (refund_amount_cents IS NULL OR refund_amount_cents >= 0),
          checked_in_at TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (event_id) REFERENCES events(id),
          FOREIGN KEY (tier_id, event_id) REFERENCES ticket_tiers(id, event_id)
        );
        INSERT INTO bookings (id, reference, user_id, event_id, tier_id, quantity, amount_cents, status, created_at)
        SELECT id, reference, user_id, event_id, tier_id, quantity, amount_cents, status, created_at
        FROM bookings_before_build8;
        DROP TABLE bookings_before_build8;
      `);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    } finally {
      database.exec('PRAGMA foreign_keys = ON');
    }
  } else {
    const bookingColumns = new Set(
      database.prepare('PRAGMA table_info(bookings)').all().map((column) => column.name),
    );
    if (!bookingColumns.has('hold_expires_at')) {
      database.exec('ALTER TABLE bookings ADD COLUMN hold_expires_at TEXT');
    }
    if (!bookingColumns.has('refund_amount_cents')) {
      database.exec('ALTER TABLE bookings ADD COLUMN refund_amount_cents INTEGER');
    }
    if (!bookingColumns.has('checked_in_at')) {
      database.exec('ALTER TABLE bookings ADD COLUMN checked_in_at TEXT');
    }
  }
  const userColumns = new Set(database.prepare('PRAGMA table_info(users)').all().map((column) => column.name));
  if (!userColumns.has('email')) database.exec('ALTER TABLE users ADD COLUMN email TEXT');
  if (!userColumns.has('password_hash')) database.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
  if (!userColumns.has('role')) {
    database.exec("ALTER TABLE users ADD COLUMN role TEXT CHECK (role IS NULL OR role IN ('attendee', 'organizer', 'staff'))");
  }
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email) WHERE email IS NOT NULL');
  return database;
}
