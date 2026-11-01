# Build 3: Architecture and server skeleton

## Goal

Define the project layers and booking lifecycle, then create a small HTTP
server foundation using Node's built-in `node:http` module. This build adds no
third-party packages and does not implement business rules in HTTP handlers.

## Deliverables

- `docs/architecture.md` with Mermaid diagrams for application layers, the
  event/ticket tier/booking/user data model, and the booking lifecycle.
- `src/domain/bookingStateMachine.js` with explicit booking states and allowed
  transitions.
- `src/http/router.js` with method/path matching and `:param` extraction.
- `src/http/app.js` with health, JSON error responses, and safe static-file
  serving.
- `src/config.js` and `src/server.js` for environment-based server startup.
- Tests for all state transitions, routing, and a real HTTP health request.

## Architecture rules

- Routes handle HTTP input and responses; business rules stay outside route
  handlers.
- Services coordinate domain rules and repositories.
- Domain rules perform no I/O and do not depend on routes, services, or
  repositories.
- Repositories handle persistence and do not implement business policy.
- Dependencies point inward; lower-level layers must not call upward.

## Booking lifecycle

Valid states:

- `pending`
- `paid`
- `cancelled`
- `refunded`
- `checked_in`

Allowed transitions:

- `pending` to `paid` or `cancelled`.
- `paid` to `checked_in`, `refunded`, or `cancelled`.
- `cancelled`, `refunded`, and `checked_in` are final.

`canTransition(from, to)` reports whether a move is allowed.
`assertTransition(from, to)` throws a `DomainError` with code
`INVALID_TRANSITION` for any illegal move.

## HTTP behavior

- `GET /health` responds with `{"status":"ok"}`.
- Unknown `/api` paths respond with a JSON 404.
- Malformed JSON responds with a JSON 400.
- Errors use the shape `{"error":{"code":"...","message":"..."}}`.
- Stack traces and internal error details are never sent to clients.
- Static files are served only from `public/`; path traversal must not expose
  files outside that directory.
- The server uses `PORT` when set and defaults to port `3000`.

## Tests

Use Node's built-in `node:test` and `node:assert/strict` to verify:

- Every allowed booking transition.
- Every disallowed transition, including attempts to leave final states.
- Router method/path matching and parameter extraction.
- A real HTTP request to `/health`.
- JSON 404 and malformed-JSON 400 responses.
- Public-file serving and rejection of paths outside `public/`.

## Definition of done

- `npm test` passes all Build 1, Build 2, and Build 3 tests.
- `npm start` starts the server on port 3000 by default.
- Setting `PORT` selects a different valid listening port.
- `GET /health` returns the expected JSON.
- Static-file requests cannot escape the public directory.

## Verification

```powershell
npm test
npm start
```

In another terminal, request `http://localhost:3000/health`.
