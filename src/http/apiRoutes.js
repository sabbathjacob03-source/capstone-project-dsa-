import { DomainError } from '../domain/errors.js';
import * as bookingService from '../services/bookingService.js';
import * as eventService from '../services/eventService.js';
import { createRouter } from './router.js';
import { requireRole } from './guards.js';
import { registerAuthRoutes } from '../routes/auth.js';

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
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
  registerAuthRoutes(router, repository);

  router.add('POST', '/api/events', async (request, response) => {
    const user = requireRole('organizer')(request);
    const event = await eventService.createEvent(repository, user.sub, request.body);
    sendJson(response, 201, event);
  });

  router.add('POST', '/api/events/:id/tiers', async (request, response, { id }) => {
    const user = requireRole('organizer')(request);
    const tier = await eventService.addTier(repository, id, user.sub, request.body);
    sendJson(response, 201, tier);
  });

  router.add('POST', '/api/events/:id/publish', async (request, response, { id }) => {
    const user = requireRole('organizer')(request);
    const event = await eventService.publishEvent(repository, id, user.sub);
    sendJson(response, 200, event);
  });

  router.add('GET', '/api/events/mine', async (request, response) => {
    const user = requireRole('organizer')(request);
    sendJson(response, 200, await eventService.listOrganizerEvents(repository, user.sub));
  });

  router.add('GET', '/api/events/:id', async (request, response, { id }) => {
    sendJson(response, 200, await eventService.getEvent(repository, id));
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
    const user = requireRole('attendee')(request);
    const booking = await bookingService.bookTickets(
      repository,
      user.sub,
      request.body,
    );
    sendJson(response, 201, booking);
  });

  router.add('GET', '/api/bookings', async (request, response) => {
    const user = requireRole('attendee')(request);
    sendJson(response, 200, await bookingService.listBookings(repository, user.sub));
  });

  router.add('GET', '/api/bookings/:reference', async (request, response, { reference }) => {
    const user = requireRole('attendee')(request);
    sendJson(response, 200, await bookingService.getBooking(repository, user.sub, reference));
  });

  router.add('POST', '/api/bookings/:reference/pay', async (request, response, { reference }) => {
    const user = requireRole('attendee')(request);
    const booking = await bookingService.payBooking(
      repository,
      user.sub,
      reference,
      request.body ?? {},
      paymentGateway,
    );
    sendJson(response, 200, booking);
  });

  router.add('POST', '/api/bookings/:reference/cancel', async (request, response, { reference }) => {
    const user = requireRole('attendee')(request);
    const booking = await bookingService.cancelBooking(
      repository,
      user.sub,
      reference,
    );
    sendJson(response, 200, booking);
  });

  return router;
}
