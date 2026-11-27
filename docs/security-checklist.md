# Security checklist

- [ ] Keep login-token and ticket-token secrets separate, unique, and outside
  Git. Production startup fails if either is missing or they are identical.
- [ ] Ticket QR data contains only a booking reference and issued-at time;
  verify HMAC-SHA256 signatures with a constant-time comparison.
- [ ] Require the staff role for check-in and accept only paid bookings.
- [ ] Change a paid booking to checked-in with one conditional atomic database
  update; retain the first check-in time for duplicate-scan responses.
- [ ] Apply a no-inline-script Content-Security-Policy, `X-Content-Type-Options:
  nosniff`, and a restrictive `Referrer-Policy`.
- [ ] Limit login and check-in attempts by the connecting IP address. Do not
  trust client-supplied forwarding headers as identity.
- [ ] Run `npm test` on every push and pull request.
