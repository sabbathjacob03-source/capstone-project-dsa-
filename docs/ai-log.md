# AI log

## Build 6

### Prompt 1: Build 6 frontend on mock data
- **What I asked:** Build event browsing and checkout with plain HTML, CSS, browser ES modules, mock data/API functions, filters, sold-out tiers, countdown, and mock payment retry.
- **What came back:** A responsive browse page and event checkout page, shared DOM/price helpers, mock API promises, quantity limits, countdown, and declined-card error handling.
- **What was wrong (or "nothing"):** Nothing after implementation. The decline rule is implemented by treating card numbers ending in `0002` as declined; this convention was added where no exact card number was specified.

## Build 7

### Prompt 1: Build 7 authentication and roles
- **What I asked:** Add password hashing and bearer-token authentication, three server-checked roles, private booking and organizer ownership rules, connected frontend pages, and tests.
- **What came back:** Scrypt password storage, HS256 tokens, signup/login/me routes, role guards, ownership checks, fetch-based frontend pages, and auth tests.
- **What was wrong (or "nothing"):** The first direct-service compatibility pass changed addTier and publish signatures in a way that broke existing direct service tests. Added overload-compatible calls so HTTP ownership checks remain strict while existing direct service tests continue to work.

## Build 8

### Prompt 1: Refunds, waitlist offers, and expiry
- **What I asked:** Add time-based refunds, single-release cancellation, FIFO expiring waitlist offers, unpaid booking expiry, attendee UI, and boundary and lifecycle tests.
- **What came back:** A pure refund policy, controlled clock, SQLite and in-memory lifecycle support, attendee API and UI flows, recurring maintenance, and Build 8 tests.
- **What was wrong (or "nothing"):** The prompt did not specify hold durations or waitlist quantities. Chose 15-minute booking holds, 15-minute offers, and one seat per waitlist entry. Added a payment-processing compare-and-set state so maintenance cannot expire a booking during an in-flight payment.

## Build 9

### Prompt 1: Signed tickets, staff check-in, and security
- **What I asked:** Add private HMAC ticket tokens, paid-ticket QR display, staff-only atomic check-in, security headers and rate limits, CI, documentation, and focused tests.
- **What came back:** Ticket-token signing and verification, a dependency-free QR Model 2 encoder, database-backed check-in, a staff page and API, HTTP security headers, per-IP rate limits, CI configuration, and tests for token forgery, duplicates, cancellation, roles, and concurrent scans.
- **What was wrong (or "nothing"):** The expected vendor QR encoder was absent from both project copies. After confirming that it was unavailable, I created a local byte-mode version 6-L encoder rather than adding a package. Its 134-byte limit fits the app's signed ticket token with the standard eight-character booking reference.
