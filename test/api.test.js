import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/http/app.js';
import { createApiRouter } from '../src/http/apiRoutes.js';
import { createMemoryRepository } from '../src/repositories/memory.js';
import { charge } from '../src/lib/mockPaymentGateway.js';

describe('in-memory REST API', () => {
  const repository = createMemoryRepository();
  const paymentRequests = [];
  const server = createApp({
    router: createApiRouter({
      repository,
      paymentGateway: async (request) => {
        paymentRequests.push(request);
        return charge(request);
      },
    }),
  });
  let baseUrl;

  before(async () => {
    server.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  async function request(path, { method = 'GET', userId, body } = {}) {
    const headers = {};
    if (userId) headers['x-user-id'] = userId;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    return { response, result };
  }

  it('creates, publishes, searches, books, pays, declines, and cancels bookings', async () => {
    const created = await request('/api/events', {
      method: 'POST',
      userId: 'organizer-1',
      body: {
        title: 'Capstone Meetup',
        city: 'Lagos',
        venue: 'Yaba Hub',
        startsAt: '2027-01-15T17:00:00Z',
      },
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.result.status, 'draft');
    assert.equal(created.result.organizerId, 'organizer-1');

    const tierResult = await request(`/api/events/${created.result.id}/tiers`, {
      method: 'POST',
      userId: 'organizer-1',
      body: { name: 'General', priceCents: 5000, capacity: 3 },
    });
    assert.equal(tierResult.response.status, 201);
    assert.equal(tierResult.result.priceCents, 5000);

    const published = await request(`/api/events/${created.result.id}/publish`, {
      method: 'POST',
      userId: 'organizer-1',
    });
    assert.equal(published.response.status, 200);
    assert.equal(published.result.status, 'published');

    const listing = await request(
      '/api/events?q=capstone&city=lagos&maxPriceCents=5000&onlyAvailable=true&sortBy=price',
    );
    assert.equal(listing.response.status, 200);
    assert.equal(listing.result.length, 1);
    assert.equal(listing.result[0].minPriceCents, 5000);
    assert.equal(listing.result[0].seatsLeft, 3);

    const bookingResult = await request('/api/bookings', {
      method: 'POST',
      userId: 'attendee-1',
      body: { tierId: tierResult.result.id, quantity: 2 },
    });
    assert.equal(bookingResult.response.status, 201);
    assert.equal(bookingResult.result.status, 'pending');
    assert.equal(bookingResult.result.amountCents, 10_000);

    const soldOut = await request('/api/bookings', {
      method: 'POST',
      userId: 'attendee-2',
      body: { tierId: tierResult.result.id, quantity: 2 },
    });
    assert.equal(soldOut.response.status, 409);
    assert.equal(soldOut.result.error.code, 'SOLD_OUT');
    assert.equal((await repository.tiers.findById(tierResult.result.id)).sold, 2);
    assert.equal((await repository.bookings.list()).length, 1);

    const forbiddenPay = await request(`/api/bookings/${bookingResult.result.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-2',
      body: {},
    });
    assert.equal(forbiddenPay.response.status, 403);
    assert.deepEqual(forbiddenPay.result, {
      error: { code: 'FORBIDDEN', message: 'Only the booking owner can pay for this booking' },
    });

    const declined = await request(`/api/bookings/${bookingResult.result.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-1',
      body: { decline: true },
    });
    assert.equal(declined.response.status, 402);
    assert.equal(declined.result.error.code, 'PAYMENT_DECLINED');
    assert.equal(
      (await repository.bookings.findByReference(bookingResult.result.reference)).status,
      'pending',
    );

    const paid = await request(`/api/bookings/${bookingResult.result.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-1',
      body: { cardNumber: 'must-not-reach-gateway' },
    });
    assert.equal(paid.response.status, 200);
    assert.equal(paid.result.status, 'paid');
    assert.deepEqual(paymentRequests, [{ decline: true }, { decline: false }]);

    const paidCancel = await request(`/api/bookings/${bookingResult.result.reference}/cancel`, {
      method: 'POST',
      userId: 'attendee-1',
    });
    assert.equal(paidCancel.response.status, 409);

    const pendingBooking = await request('/api/bookings', {
      method: 'POST',
      userId: 'attendee-2',
      body: { tierId: tierResult.result.id, quantity: 1 },
    });
    const forbiddenCancel = await request(`/api/bookings/${pendingBooking.result.reference}/cancel`, {
      method: 'POST',
      userId: 'attendee-1',
    });
    assert.equal(forbiddenCancel.response.status, 403);
    const cancelled = await request(`/api/bookings/${pendingBooking.result.reference}/cancel`, {
      method: 'POST',
      userId: 'attendee-2',
    });
    assert.equal(cancelled.response.status, 200);
    assert.equal(cancelled.result.status, 'cancelled');
    const repeatedCancel = await request(`/api/bookings/${pendingBooking.result.reference}/cancel`, {
      method: 'POST',
      userId: 'attendee-2',
    });
    assert.equal(repeatedCancel.response.status, 409);

    const afterCancellation = await request('/api/events?onlyAvailable=true');
    assert.equal(afterCancellation.result[0].seatsLeft, 1);
  });

  it('requires x-user-id for mutations and uses the shared error response shape', async () => {
    const result = await request('/api/events', {
      method: 'POST',
      body: { title: 'Missing caller' },
    });
    assert.equal(result.response.status, 401);
    assert.deepEqual(result.result, {
      error: { code: 'UNAUTHENTICATED', message: 'The x-user-id header is required' },
    });
  });

  it('returns a consistent JSON 404 for an unknown API route', async () => {
    const result = await request('/api/missing');
    assert.equal(result.response.status, 404);
    assert.deepEqual(result.result, {
      error: { code: 'NOT_FOUND', message: 'API route not found' },
    });
  });
});

describe('mock payment gateway', () => {
  it('succeeds by default and declines when explicitly requested', async () => {
    assert.deepEqual(await charge(), { status: 'succeeded' });
    assert.deepEqual(await charge({ decline: true }), { status: 'declined' });
  });
});
