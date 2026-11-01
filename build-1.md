# Build 1: Domain core

## Goal

Build the event ticketing rules as plain JavaScript ES modules that run in the
terminal. This milestone has no server or database and needs no outside
packages.

## Deliverables

- A `DomainError` type with a machine-readable error code.
- Secure ID and readable booking-reference generation using `node:crypto`.
- A linked-list queue for first-in-first-out waitlists, with O(1)
  `enqueue`, `dequeue`, `peek`, and `size`.
- In-memory events, ticket tiers, bookings, cancellations, and waitlists.
- O(1) booking lookup by reference using a `Map`.
- A terminal demo and a benchmark comparing `Map.get` with `Array.find`.

## Domain rules

- Store money as whole cents, never floating-point currency amounts.
- Validate inputs and report expected failures with a `DomainError` code.
- A booking may contain between 1 and 10 tickets from one tier.
- A booking that exceeds available capacity fails with `SOLD_OUT` and changes
  no inventory or booking data.
- Cancelling a booking releases its seats exactly once. Cancelling it again is
  an error.
- Waitlist entries are served in first-in-first-out order.
- Do not use `Math.random` for IDs or references, or `Array.shift` for the
  queue.

## Definition of done

- `npm run demo` shows an event selling out, an attempted booking being refused,
  two people joining the waitlist, a booking being cancelled, and the next
  eligible person being named.
- `npm run benchmark` compares lookup timings for many bookings and shows the
  `Map` lookup is faster than `Array.find`.
- A failed booking leaves both available capacity and stored bookings
  unchanged.
- Cancelling twice does not release seats twice.
- Queue operations preserve FIFO order and handle an empty queue.

## Suggested verification

```text
npm run demo
npm run benchmark
npm test
```

## Build 1 progression

1. Define the domain error and ID helpers.
2. Implement and verify the linked-list queue.
3. Add event, tier, booking, cancellation, and waitlist rules.
4. Demonstrate the booking flow in the terminal.
5. Measure reference lookup with an array and a map.
