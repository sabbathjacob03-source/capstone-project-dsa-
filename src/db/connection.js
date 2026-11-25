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
  const userColumns = new Set(database.prepare('PRAGMA table_info(users)').all().map((column) => column.name));
  if (!userColumns.has('email')) database.exec('ALTER TABLE users ADD COLUMN email TEXT');
  if (!userColumns.has('password_hash')) database.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
  if (!userColumns.has('role')) {
    database.exec("ALTER TABLE users ADD COLUMN role TEXT CHECK (role IS NULL OR role IN ('attendee', 'organizer', 'staff'))");
  }
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email) WHERE email IS NOT NULL');
  return database;
}
