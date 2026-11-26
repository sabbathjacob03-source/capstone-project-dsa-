# Build 8: Refunds, waitlist, and expiry

Build 8 completes booking cancellation, gives waitlisted attendees a timed
chance at freed seats, and releases unpaid booking holds automatically.

## Rules

- Refunds are 100% at least 7 days before an event, 50% at least 2 days
  before, and 0% closer to the event. Exact boundaries use the better tier.
- Refunds use whole cents and round down. Cancellation after an event starts
  is rejected.
- A paid booking is claimed through the booking state machine before the mock
  refund is requested. Its seats are released once, after a successful refund.
- Unpaid booking holds last 15 minutes. Expiring or cancelling a booking
  releases its seats once.
- A freed seat is offered to the earliest eligible waitlisted attendee for
  15 minutes. The offer reserves the seat; accepting it creates a pending
  booking with a new 15-minute payment hold.
- A waitlist entry represents one seat. Attendees can join only when a tier is
  sold out, and cannot have duplicate active entries for the same tier.

## API

- `GET /api/bookings/:reference/refund` previews the refund amount.
- `POST /api/bookings/:reference/cancel` cancels a pending booking or refunds
  and cancels a paid booking.
- `POST /api/waitlist` joins a sold-out tier with `{ "tierId": "..." }`.
- `GET /api/waitlist/offers` lists the signed-in attendee's active offers.
- `POST /api/waitlist/offers/:id/accept` accepts an unexpired offer and creates
  a pending booking.

The server runs booking and waitlist expiry maintenance once per minute. Tests
can run maintenance directly with a controllable clock.

## Verification

Run `npm test`. Tests cover each refund boundary, started events, duplicate
cancellation, FIFO offers, offer expiry and handoff, unpaid hold expiry, and
the SQLite reservation and acceptance flow.

The optional debugging exercise is supplied separately by the instructor.

[Milestones](milestones.md) · [Build 7](build-7.md) · [Build 9](build-9.md)
