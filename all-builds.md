# Event Ticketing Capstone: All Builds

This document is a high-level roadmap of the nine capstone builds. Each build
adds a layer to the event ticketing platform, from its booking rules to a
demo-ready application.

## Build 1: Domain core

Create the in-memory rules for events, ticket tiers, bookings, capacity,
cancellations, and a first-in-first-out waitlist. Add booking lookup by
reference, a terminal demo, and a lookup benchmark.

**Main deliverable:** A working domain core with no server or database.

## Build 2: Search, sorting, and first tests

Add event search and filtering, implement merge sort, and define the product
backlog as user stories with acceptance criteria. Begin automated testing with
Node's built-in test runner.

**Main deliverable:** Tested event discovery and a written, prioritized backlog.

## Build 3: Architecture and server skeleton

Document the application layers, model booking lifecycle transitions with a
state machine, and create the initial HTTP server and router. Serve the public
site files and provide a health-check endpoint.

**Main deliverable:** A documented architecture and a testable server
foundation.

## Build 4: In-memory REST API

Expose event creation, publishing, searching, booking, mock payment, and
cancellation through HTTP endpoints. Keep domain rules separate from HTTP
handling and make dependencies replaceable for testing.

**Main deliverable:** A working REST API backed by in-memory data.

## Build 5: SQLite and overselling prevention

Persist application data in SQLite. Use database constraints and atomic
inventory updates to prevent concurrent booking attempts from selling more
tickets than a tier's capacity.

**Main deliverable:** Persistent booking data and a tested last-ticket
concurrency rule.

## Build 6: Frontend on mock data

Build the browser interface for browsing and filtering events, viewing event
details, selecting tickets, and checking out. Include a countdown and simulated
card payment without moving real money.

**Main deliverable:** An accessible, usable frontend connected to mock data.

## Build 7: Authentication and connected roles

Add signup and login, connect the frontend to the API, and enforce separate
permissions for organizers, attendees, and staff. Protect private data and
restrict access to each role's allowed actions.

**Main deliverable:** A connected application with authenticated,
role-appropriate access.

## Build 8: Refunds and complete waitlist lifecycle

Implement the refund policy and cancellation flow. Offer newly available
tickets to waitlisted attendees with an expiry time, pass expired offers to the
next eligible person, and expire unpaid bookings. Expand tests for boundaries,
time-dependent behavior, and concurrency.

**Main deliverable:** Tested refunds, expiring bookings, and time-limited
waitlist offers.

## Build 9: Check-in, CI, and security

Issue signed QR tickets and build staff check-in for assigned events. Reject
forged or repeated scans, add security headers and rate limiting, and run the
test suite automatically in continuous integration.

**Main deliverable:** A demo-ready project with secure check-in and automated
CI checks.

## Capstone progression

1. Establish the booking rules.
2. Make events discoverable and testable.
3. Lay out the architecture and server foundation.
4. Expose the domain through an API.
5. Persist data and prevent overselling.
6. Add the attendee-facing frontend.
7. Connect users and enforce roles.
8. Complete refunds, expiry, and waitlist offers.
9. Add check-in, security hardening, and CI.
