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
  return database;
}
