# Build 7: Login, roles and a connected app

*Week 10 of the course. Starts from the finished state of Build 6.*

**You deliver:** signup and login with safely stored passwords and signed
tokens, three roles, checks that people only see their own data, and the website
talking to the real API. New pages: login, my tickets, and organizer dashboard.

**You practise:** `fetch`, password hashing, tokens, authentication versus
authorization, and loading and error states.

## Done when

- An organizer can sign up, create an event, add ticket tiers, and publish it
  in the browser.
- An attendee can sign up, browse published events, book tickets, pay with the
  mock payment gateway, and see their tickets.
- One attendee cannot read or cancel another attendee's booking.
- One organizer cannot change another organizer's event.
- Protected API requests use bearer tokens and reject missing, invalid, or
  expired tokens.
- `npm test` covers signup, login, bad and expired tokens, wrong roles, and
  booking privacy.

## User stories in this build

### S01: As a visitor, I want to sign up and log in, so that my bookings are private

- **Given** a new email and a password of at least 8 characters
  **When** a visitor signs up
  **Then** an account is created, the password is stored only as a hash, and a
  signed token is returned.
- **Given** an email that is already registered
  **When** someone signs up with it
  **Then** the request is rejected with `EMAIL_TAKEN`.
- **Given** correct credentials
  **When** the user logs in
  **Then** a signed token is returned.
- **Given** a wrong password or an unknown email
  **When** someone logs in
  **Then** the request is rejected with `INVALID_CREDENTIALS`, with the same
  message for both cases.
- **Given** a missing, edited, or expired token
  **When** any protected request is made
  **Then** it is rejected with `UNAUTHENTICATED`.

### S13: As an attendee, I want to see only my own bookings, so that my data is private

- **Given** attendee A has a booking
  **When** attendee B asks for it
  **Then** the request does not reveal the booking and returns `NOT_FOUND`.
- **Given** an attendee
  **When** they ask for the list of bookings
  **Then** only their own bookings are returned.
- **Given** organizer A's event
  **When** organizer B tries to change it
  **Then** the request is rejected with `FORBIDDEN`.
- **Given** an attendee account
  **When** it tries to create an event
  **Then** the request is rejected with `FORBIDDEN`.

**Status-code note:** the Build 7 implementation prompt specifies `NOT_FOUND`
for another attendee's booking to avoid revealing whether it exists. The
backlog's S13 wording says `FORBIDDEN` for that case. Resolve this discrepancy
with the instructor if the course rubric expects one status over the other.

### Organizer screens: S02, S03, and S04

Organizers create events, add ticket tiers, and publish events through the
website. Their acceptance criteria are in [Build 2](build-2.md), with these
additional Build 7 checks:

- The organizer must be logged in to create an event or change its tiers or
  publication status.
- Only the organizer who owns an event can change it.
- The server checks the role and ownership; hiding controls in the page is not
  an authorization check.

## AI prompt

Read `readme.md`, `docs/user-stories.md`, this file, `docs/api-examples.md`, and
all files in `src/` and `public/` before making changes.

```text
We are building Build 7 of the Event Ticketing capstone in plain JavaScript
(ES modules, Node 22.13 or newer, no outside packages).

1. Add src/lib/password.js to hash and verify passwords with scrypt from
   node:crypto, using a random salt per password and a constant-time comparison.

2. Add src/lib/token.js to sign and verify expiring HS256 tokens with
   node:crypto. Reject tokens whose header has any algorithm other than HS256.
   Read the signing secret from an environment variable.

3. Add signup, login, and GET /api/auth/me routes and an auth service.
   Signup accepts email, a password of at least 8 characters, and one of the
   roles attendee, organizer, or staff. Wrong passwords and unknown emails
   return the same INVALID_CREDENTIALS error. Repeated email returns
   EMAIL_TAKEN.

4. Add requireUser and requireRole HTTP guards. Replace x-user-id headers with
   bearer tokens. Attendees can only read or cancel their own bookings; return
   NOT_FOUND for another attendee's booking. Organizers can only change their
   own events; otherwise return FORBIDDEN.

5. Connect the frontend API module to fetch and send
   Authorization: Bearer <token>. Add session handling, a login page, a My
   Tickets page, and an organizer page to create events and ticket tiers and
   publish events. Show loading and error states.

6. Add tests for signup, login, bad tokens, expired tokens, wrong roles, and an
   attendee trying to read another attendee's booking.

Rules: never store, log, or return a password. Check roles on the server, not
only in the page. When finished, list every changed file and any rule that was
unclear.
```

## Definition of done

The Definition of done in [user-stories.md](user-stories.md) applies to every
story in this build.

[Milestones](milestones.md) · [Build 6](build-6.md)
