# Event Ticketing Capstone

A JavaScript capstone project exploring the domain rules and software
architecture behind an event ticketing platform. The planned application grows
from event and booking rules into a full-stack system with an API, persistence,
an attendee-facing website, authentication, refunds, and check-in.

Payments in the planned application are simulated; no real money is charged.

## Requirements

- Node.js 22.13 or newer
- npm (included with Node.js)

The current project uses JavaScript ES modules and Node's built-in test runner.
There are no third-party runtime dependencies.

## Getting started

From the project root, run the tests:

```powershell
npm test
```

The test command runs the sorting, event-search, and inventory tests in `test/`.

## Current features

- Stable merge sort that returns a new array without changing its input.
- Event filtering by query, city, date range, maximum ticket price, and
  availability.
- Event sorting by date, cheapest price, or remaining seats.
- Publishing events and listing summaries while hiding drafts by default.
- Automated tests using `node:test` and `node:assert/strict`.

## Build roadmap

The capstone is organized as nine milestones:

1. **Domain core:** event ticket tiers, booking rules, capacity, cancellations,
   waitlists, and booking-reference lookup.
2. **Search and sorting:** event discovery, stable merge sort, and initial
   automated tests.
3. **Architecture and server skeleton:** layered design, booking state machine,
   and initial HTTP server.
4. **In-memory REST API:** event and booking operations over HTTP.
5. **SQLite and overselling prevention:** persistence and atomic capacity
   updates.
6. **Frontend:** event browsing and mock checkout.
7. **Authentication and roles:** connected organizer, attendee, and staff
   experiences.
8. **Refunds and waitlists:** refund rules, expiring bookings, and time-limited
   waitlist offers.
9. **Check-in, CI, and security:** signed QR tickets, staff check-in, security
   protections, and automated checks.

See [all-builds.md](./all-builds.md) for the high-level roadmap,
[build-1.md](./build-1.md) for the first milestone, and
[build-2.md](./build-2.md) for the current search and sorting milestone.

## Project layout

```text
src/domain/  Domain errors, event summaries, search, and sorting
test/        Automated tests
docs/        Additional project documentation as it is added
```

## Development notes

- Store money as whole cents, not floating-point currency amounts.
- Keep event filtering and sorting pure: return new lists and do not mutate
  inputs.
- Use stable, machine-readable domain error codes for expected failures.
- Update this README as new builds add setup, API, database, and deployment
  instructions.