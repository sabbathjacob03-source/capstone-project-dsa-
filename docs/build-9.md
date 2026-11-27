# Build 9: Ticket check-in and security

## Goal

Let staff validate paid tickets at the door, prevent forged or repeated
admissions, and add baseline HTTP protections and CI. The implementation uses
plain JavaScript ES modules, Node.js 22.13 or newer, and no outside packages.

## Acceptance criteria

1. Ticket tokens use HMAC-SHA256 and constant-time signature comparison. The
   payload contains only the booking reference and issued-at time. Set
   `TICKET_TOKEN_SECRET` separately from the login-token secret; production
   code has no fallback secret.
2. The tickets page renders a QR code for every paid booking using the
   dependency-free encoder at `public/js/qr.js`. It encodes UTF-8 byte-mode
   QR Model 2, version 6-L, for ASCII payloads up to 134 bytes.
3. Staff can paste or scan a ticket code at `/checkin.html`. `POST /api/checkin`
   admits only paid bookings and uses one conditional SQLite `UPDATE` so only
   one simultaneous scan succeeds. Forged, cancelled, and refunded tickets are
   invalid. A duplicate response reports the original check-in time.
4. HTTP responses include a restrictive Content-Security-Policy with no inline
   scripts, `X-Content-Type-Options`, and `Referrer-Policy`. Login and check-in
   attempts are limited per client IP.
5. GitHub Actions runs `npm test` with Node 22.13 on pushes and pull requests.
6. `.env.example` contains placeholders only, and the security checklist
   describes the data and controls in scope.
7. Tests cover token forgery, duplicate and cancelled tickets, role denial,
   and simultaneous scans.

The current rate-limit defaults are five login attempts per IP per 15 minutes
and 30 check-in attempts per IP per minute. Configure local secrets as
environment variables; `.env.example` is documentation and is not loaded by
the application.

## Definition of done

The [Definition of done](./user-stories.md#definition-of-done-every-story)
applies to every story in this build.
