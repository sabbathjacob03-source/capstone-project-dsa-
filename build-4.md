# Build 4: In-memory REST API

## Goal

Expose event and booking workflows through a REST API backed by in-memory
repositories. Keep HTTP handling, service workflows, domain rules, and
persistence in their own layers. Use Node.js built-ins only.

## Deliverables

- `src/repositories/memory.js`: async in-memory repositories for events,
  ticket tiers, and bookings.
- `src/services/eventService.js` and `src/services/bookingService.js`: business
  workflows that receive repositories as dependencies.
- `src/lib/mockPaymentGateway.js`: a mock charge function with success and
  decline outcomes; it must never receive card numbers.
- `src/http/apiRoutes.js`: REST endpoints connected to the services.
- `docs/api-examples.md`: curl examples for the API calls.
- API tests using `node:test` and a real HTTP server listening on a free port.

## Layering rules

- Routes parse HTTP input, call services, and format HTTP responses.
- Services receive repositories as arguments; they do not import concrete
  repository implementations.
- Business rules belong in services and existing domain functions, not route
  handlers.
- Reuse the existing domain state machine, event search, and sorting behavior;
  do not copy those rules into services.
- Keep persistence in the repository layer.

## API endpoints

Every mutating request requires an `x-user-id` header until authentication is
introduced in Build 7.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/events` | Create an event |
| `POST` | `/api/events/:id/tiers` | Add a ticket tier |
| `POST` | `/api/events/:id/publish` | Publish an event |
| `GET` | `/api/events` | Search, filter, and sort published events |
| `POST` | `/api/bookings` | Book tickets from a tier |
| `POST` | `/api/bookings/:reference/pay` | Attempt mock payment |
| `POST` | `/api/bookings/:reference/cancel` | Cancel an unpaid booking |

Event search accepts the Build 2 query and sorting options, including `q`,
`city`, `from`, `to`, `maxPriceCents`, `onlyAvailable`, and `sortBy`.

## Booking and payment rules

- Store money as whole cents.
- A caller can pay for a booking only when their `x-user-id` matches its owner.
- A declined mock payment returns `PAYMENT_DECLINED` and leaves the booking in
  `pending`.
- The mock payment gateway receives no card number.
- Build 4 cancellation is available only for unpaid (`pending`) bookings.
- Cancelling releases the booked seats.
- Do not add locks or transactions in this build.
- Use the same `{"error":{"code":"...","message":"..."}}` error shape as the
  existing HTTP app.

## API examples

See [docs/api-examples.md](./docs/api-examples.md) for PowerShell `curl.exe`
examples. The suggested sequence is create an event, add a tier, publish,
search, book, pay, and cancel a pending booking.

## Tests and verification

Use Node's built-in `node:test` and `node:assert/strict`. Start the real server
on a free port and cover:

- The event creation, tier, publish, and search flow.
- Booking capacity and whole-cent totals.
- Successful and declined payment behavior.
- The declined payment leaving the booking pending.
- Owner-only payment and cancellation.
- Cancellation being restricted to unpaid bookings and releasing inventory.
- Shared JSON error responses for missing identity, invalid requests, and
  unknown API routes.
- Payment input not exposing card numbers to the mock gateway.

Run the complete test suite with:

```powershell
npm test
```

Start the API with:

```powershell
npm start
```

## Definition of done

- `npm test` passes the existing tests and the Build 4 API tests.
- All listed endpoints work through the actual HTTP server.
- Event search reuses the domain filtering and sorting functions.
- Payment declines do not change booking state.
- Services depend on injected repositories, and routes contain no business
  rules.
