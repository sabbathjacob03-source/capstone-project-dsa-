# Build 5: SQLite and overselling prevention

## Goal

Replace the server's in-memory persistence with SQLite and ensure concurrent
booking requests cannot sell more tickets than a tier's capacity. Use Node.js
built-ins only, including `node:sqlite`.

## Deliverables

- `src/db/schema.sql`: SQLite tables for users, events, ticket tiers, and
  bookings, with primary keys, foreign keys, uniqueness, and validation
  constraints.
- `src/db/connection.js`: opens the database and enables foreign-key checks.
- `src/repositories/sqlite.js`: persistent repository with the same collection
  methods as the in-memory repository, plus an atomic booking reservation.
- `scripts/seed.js`: initializes sample data once.
- `scripts/oversell-demo.js`: compares the unsafe check-then-write race with
  the SQLite reservation.
- `test/oversell.test.js`: proves only one of 50 requests can book the final
  seat.

## Database and booking rules

- Keep the SQLite database at `data/ticketing.sqlite`; do not commit database
  files.
- Enable SQLite foreign-key enforcement on every connection.
- Enforce `CHECK (sold >= 0 AND sold <= capacity)` on ticket tiers.
- Use prepared statements and bound placeholders for all data values.
- Reserve inventory with one conditional update:

  ```sql
  UPDATE ticket_tiers
  SET sold = sold + ?
  WHERE id = ? AND sold + ? <= capacity
  ```

- Check the number of changed rows. If none changed, reject with `SOLD_OUT`.
- Insert the booking in the same transaction as the reservation, so a failed
  insert rolls back the seat update.
- The server uses SQLite so application data survives a restart. Services
  continue to receive a repository rather than importing a concrete adapter.

## Overselling demonstration

Run:

```powershell
npm run oversell
```

The demo first simulates 50 requests that all check the same last seat before
writing, showing why that approach oversells. It then creates a SQLite tier
with one seat left and sends 50 concurrent booking attempts; one should
succeed, 49 should receive `SOLD_OUT`, and sold inventory must equal capacity.

Do not use a JavaScript lock variable: it only coordinates code within one
process and cannot protect the database from other processes or clients.
Do not check availability and then update separately: concurrent requests can
both observe the same seat as available before either write happens.

## Setup and verification

From the project root:

```powershell
npm run seed
npm start
```

The seed command skips if event data already exists. The database file remains
available after the server exits and starts again.

Run the test suite with:

```powershell
npm test
```

The overselling regression test must assert exactly one success, 49 `SOLD_OUT`
failures, and that sold inventory never exceeds capacity. Removing the
conditional atomic update must cause this test to fail.

## Definition of done

- Existing API behavior remains covered by the test suite.
- Server data persists across restarts.
- `npm run oversell` shows the unsafe race and the corrected SQLite result.
- Fifty concurrent attempts for one remaining seat produce one success and 49
  `SOLD_OUT` results.
