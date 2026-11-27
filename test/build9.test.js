import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../src/lib/clock.js';
import { signToken } from '../src/lib/token.js';
import { signTicketToken, verifyTicketToken } from '../src/lib/ticketToken.js';
import { createRateLimiter } from '../src/lib/rateLimit.js';
import { createApp } from '../src/http/app.js';
import { createApiRouter } from '../src/http/apiRoutes.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import * as bookingService from '../src/services/bookingService.js';
import * as eventService from '../src/services/eventService.js';

process.env.TOKEN_SECRET = 'build-9-login-test-secret';
process.env.TICKET_TOKEN_SECRET = 'build-9-separate-ticket-test-secret';

describe('Build 9 ticket token and check-in', () => {
  const now = new Date('2027-01-01T12:00:00.000Z');
  const clock = createClock(() => now);
  const repository = createSqliteRepository({ databasePath: ':memory:' });
  let tier;
  const server = createApp({
    router: createApiRouter({ repository, clock }),
  });
  let baseUrl;

  before(async () => {
    const event = await eventService.createEvent(repository, 'build9-organizer', {
      title: 'Build 9 Event',
      city: 'Lagos',
      venue: 'Yaba Hub',
      startsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    tier = await eventService.addTier(repository, event.id, 'build9-organizer', {
      name: 'General',
      priceCents: 5000,
      capacity: 10,
    });
    await eventService.publishEvent(repository, event.id);
    server.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    repository.close();
  });

  function token(role = 'staff', sub = `build9-${role}`) {
    return signToken({ sub, role });
  }

  async function request(code, bearerToken = token()) {
    const response = await fetch(`${baseUrl}/api/checkin`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bearerToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });
    return { status: response.status, body: await response.json() };
  }

  async function listFor(userId) {
    const response = await fetch(`${baseUrl}/api/bookings`, {
      headers: { authorization: `Bearer ${token('attendee', userId)}` },
    });
    return { status: response.status, body: await response.json() };
  }

  async function paidBooking(userId) {
    const booking = await bookingService.bookTickets(
      repository,
      userId,
      { tierId: tier.id, quantity: 1 },
      clock,
    );
    return bookingService.payBooking(repository, userId, booking.reference, {}, undefined, clock);
  }

  it('signs only a reference and issued-at value and rejects an edited token', async () => {
    const booking = await paidBooking('build9-forged');
    const ticketToken = signTicketToken(booking.reference);
    const payload = JSON.parse(Buffer.from(ticketToken.split('.')[0], 'base64url').toString('utf8'));
    assert.deepEqual(Object.keys(payload).sort(), ['iat', 'reference']);
    assert.equal(payload.reference, booking.reference);
    const listed = await listFor(booking.userId);
    assert.equal(listed.status, 200);
    assert.equal(
      verifyTicketToken(listed.body[0].ticketToken).reference,
      booking.reference,
    );

    const [payloadPart, signaturePart] = ticketToken.split('.');
    const changedSignature = `${signaturePart[0] === 'A' ? 'B' : 'A'}${signaturePart.slice(1)}`;
    const result = await request(`${payloadPart}.${changedSignature}`);
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, 'INVALID');
    assert.equal((await repository.bookings.findByReference(booking.reference)).status, 'paid');
  });

  it('admits a paid booking once and reports when a duplicate was first used', async () => {
    const booking = await paidBooking('build9-duplicate');
    const code = signTicketToken(booking.reference);
    const first = await request(code);
    const second = await request(code);
    assert.equal(first.status, 200);
    assert.equal(first.body.admitted, true);
    assert.equal(second.status, 409);
    assert.equal(second.body.error.code, 'DUPLICATE_SCAN');
    assert.equal(second.body.error.checkedInAt, first.body.checkedInAt);
    assert.equal((await repository.bookings.findByReference(booking.reference)).status, 'checked_in');
  });

  it('rejects a cancelled booking code and a non-staff user', async () => {
    const cancelled = await bookingService.bookTickets(
      repository,
      'build9-cancelled',
      { tierId: tier.id, quantity: 1 },
      clock,
    );
    await bookingService.cancelBooking(repository, cancelled.userId, cancelled.reference, undefined, clock);
    const cancelledResult = await request(signTicketToken(cancelled.reference));
    assert.equal(cancelledResult.status, 400);
    assert.equal(cancelledResult.body.error.code, 'INVALID');

    const paid = await paidBooking('build9-wrong-role');
    const forbidden = await request(signTicketToken(paid.reference), token('attendee'));
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error.code, 'FORBIDDEN');
    assert.equal((await repository.bookings.findByReference(paid.reference)).status, 'paid');
  });

  it('admits exactly one of two simultaneous scans', async () => {
    const booking = await paidBooking('build9-race');
    const code = signTicketToken(booking.reference);
    const [first, second] = await Promise.all([request(code), request(code)]);
    assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  });
});

describe('Build 9 IP rate limiter', () => {
  it('limits each key independently and resets after the window', () => {
    let now = 1000;
    const limiter = createRateLimiter({ limit: 2, windowMs: 100, clock: () => now });
    assert.equal(limiter.allow('127.0.0.1'), true);
    assert.equal(limiter.allow('127.0.0.1'), true);
    assert.equal(limiter.allow('127.0.0.1'), false);
    assert.equal(limiter.allow('127.0.0.2'), true);
    now = 1100;
    assert.equal(limiter.allow('127.0.0.1'), true);
  });
});
