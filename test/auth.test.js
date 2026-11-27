import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/http/app.js';
import { createApiRouter } from '../src/http/apiRoutes.js';
import { createMemoryRepository } from '../src/repositories/memory.js';
import { signToken } from '../src/lib/token.js';

process.env.TOKEN_SECRET = 'build-7-test-secret';
process.env.TICKET_TOKEN_SECRET = 'build-9-ticket-test-secret';

describe('Build 7 authentication and authorization', () => {
  const repository = createMemoryRepository();
  const server = createApp({ router: createApiRouter({ repository }) });
  let baseUrl;

  before(async () => {
    server.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function request(path, { method = 'GET', token, body } = {}) {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { response, result: await response.json() };
  }

  it('signs up and logs in, and rejects duplicate or invalid credentials', async () => {
    const signup = await request('/api/auth/signup', {
      method: 'POST',
      body: { email: 'Ada@Example.com', password: 'password123', role: 'attendee' },
    });
    assert.equal(signup.response.status, 201);
    assert.equal(signup.result.user.email, 'ada@example.com');
    assert.equal(signup.result.user.passwordHash, undefined);
    assert.equal(signup.result.user.password, undefined);

    const duplicate = await request('/api/auth/signup', {
      method: 'POST',
      body: { email: 'ada@example.com', password: 'password123', role: 'attendee' },
    });
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.result.error.code, 'EMAIL_TAKEN');

    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'ada@example.com', password: 'password123' },
    });
    assert.equal(login.response.status, 200);
    assert.ok(login.result.token);

    const wrongPassword = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'ada@example.com', password: 'wrong-password' },
    });
    const unknownEmail = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody@example.com', password: 'password123' },
    });
    assert.equal(wrongPassword.result.error.code, 'INVALID_CREDENTIALS');
    assert.equal(unknownEmail.result.error.code, 'INVALID_CREDENTIALS');
    assert.deepEqual(wrongPassword.result, unknownEmail.result);

    const me = await request('/api/auth/me', { token: login.result.token });
    assert.equal(me.response.status, 200);
    assert.equal(me.result.email, 'ada@example.com');
  });

  it('rejects bad and expired tokens and enforces roles', async () => {
    const bad = await request('/api/events', {
      method: 'POST',
      token: 'not-a-token',
      body: { title: 'No', city: 'Lagos', venue: 'Hub', startsAt: '2027-01-15T17:00:00Z' },
    });
    assert.equal(bad.response.status, 401);
    assert.equal(bad.result.error.code, 'UNAUTHENTICATED');

    const expired = signToken({ sub: 'attendee-expired', role: 'attendee' }, process.env.TOKEN_SECRET, { expiresInSeconds: -1 });
    const expiredResult = await request('/api/bookings', { token: expired });
    assert.equal(expiredResult.response.status, 401);

    const wrongAlg = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const wrongAlgPayload = Buffer.from(JSON.stringify({ sub: 'attendee-expired', role: 'attendee', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const wrongAlgResult = await request('/api/bookings', {
      token: `${wrongAlg}.${wrongAlgPayload}.signature`,
    });
    assert.equal(wrongAlgResult.response.status, 401);

    const attendeeSignup = await request('/api/auth/signup', {
      method: 'POST',
      body: { email: 'attendee2@example.com', password: 'password123', role: 'attendee' },
    });
    const wrongRole = await request('/api/events', {
      method: 'POST',
      token: attendeeSignup.result.token,
      body: { title: 'No', city: 'Lagos', venue: 'Hub', startsAt: '2027-01-15T17:00:00Z' },
    });
    assert.equal(wrongRole.response.status, 403);
    assert.equal(wrongRole.result.error.code, 'FORBIDDEN');
  });

  it('prevents one attendee reading another attendee booking', async () => {
    const organizer = await request('/api/auth/signup', {
      method: 'POST',
      body: { email: 'organizer@example.com', password: 'password123', role: 'organizer' },
    });
    const event = await request('/api/events', {
      method: 'POST',
      token: organizer.result.token,
      body: { title: 'Private Event', city: 'Lagos', venue: 'Hub', startsAt: '2027-01-15T17:00:00Z' },
    });
    const tier = await request(`/api/events/${event.result.id}/tiers`, {
      method: 'POST',
      token: organizer.result.token,
      body: { name: 'General', priceCents: 5000, capacity: 10 },
    });
    await request(`/api/events/${event.result.id}/publish`, {
      method: 'POST',
      token: organizer.result.token,
    });

    const attendeeA = await request('/api/auth/signup', {
      method: 'POST',
      body: { email: 'attendee-a@example.com', password: 'password123', role: 'attendee' },
    });
    const attendeeB = await request('/api/auth/signup', {
      method: 'POST',
      body: { email: 'attendee-b@example.com', password: 'password123', role: 'attendee' },
    });
    const booking = await request('/api/bookings', {
      method: 'POST',
      token: attendeeA.result.token,
      body: { tierId: tier.result.id, quantity: 1 },
    });
    assert.equal(booking.response.status, 201);
    const otherRead = await request(`/api/bookings/${booking.result.reference}`, {
      token: attendeeB.result.token,
    });
    assert.equal(otherRead.response.status, 404);
    assert.equal(otherRead.result.error.code, 'NOT_FOUND');
  });
});
