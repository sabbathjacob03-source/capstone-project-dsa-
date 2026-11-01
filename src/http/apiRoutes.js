import { DomainError } from '../domain/errors.js';
import * as bookingService from '../services/bookingService.js';
import * as eventService from '../services/eventService.js';
import { createRouter } from './router.js';

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function requireUserId(request) {
  const userId = request.headers['x-user-id'];
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new DomainError('UNAUTHENTICATED', 'The x-user-id header is required');
  }
  return userId.trim();
}

function searchCriteria(url) {
  const criteria = {};
  for (const key of ['q', 'city', 'from', 'to']) {
    if (url.searchParams.has(key)) criteria[key] = url.searchParams.get(key);
  }
  if (url.searchParams.has('maxPriceCents')) {
    const value = url.searchParams.get('maxPriceCents');
    criteria.maxPriceCents = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  }
  if (url.searchParams.has('onlyAvailable')) {
    const value = url.searchParams.get('onlyAvailable');
    criteria.onlyAvailable = value === 'true' ? true : value === 'false' ? false : value;
  }
  return criteria;
}

export function createApiRouter({ repository, paymentGateway } = {}) {
  if (!repository) throw new DomainError('VALIDATION', 'A repository is required');
  const router = createRouter();

  router.add('POST', '/api/events', async (request, response) => {
    const event = await eventService.createEvent(repository, requireUserId(request), request.body);
    sendJson(response, 201, event);
  });

  router.add('POST', '/api/events/:id/tiers', async (request, response, { id }) => {
    requireUserId(request);
    const tier = await eventService.addTier(repository, id, request.body);
    sendJson(response, 201, tier);
  });

  router.add('POST', '/api/events/:id/publish', async (request, response, { id }) => {
    requireUserId(request);
    const event = await eventService.publishEvent(repository, id);
    sendJson(response, 200, event);
  });

  router.add('GET', '/api/events', async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const events = await eventService.listEvents(
      repository,
      searchCriteria(url),
      url.searchParams.get('sortBy') ?? 'date',
    );
    sendJson(response, 200, events);
  });

  router.add('POST', '/api/bookings', async (request, response) => {
    const booking = await bookingService.bookTickets(
      repository,
      requireUserId(request),
      request.body,
    );
    sendJson(response, 201, booking);
  });

  router.add('POST', '/api/bookings/:reference/pay', async (request, response, { reference }) => {
    const booking = await bookingService.payBooking(
      repository,
      requireUserId(request),
      reference,
      request.body ?? {},
      paymentGateway,
    );
    sendJson(response, 200, booking);
  });

  router.add('POST', '/api/bookings/:reference/cancel', async (request, response, { reference }) => {
    const booking = await bookingService.cancelBooking(
      repository,
      requireUserId(request),
      reference,
    );
    sendJson(response, 200, booking);
  });

  return router;
}
