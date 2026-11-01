import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Router } from '../src/http/router.js';
import { DomainError } from '../src/domain/errors.js';

describe('Router', () => {
  it('matches an HTTP method and path and extracts decoded parameters', () => {
    const handler = () => {};
    const router = new Router().add('get', '/events/:eventId/bookings/:reference', handler);
    const match = router.match('GET', '/events/event%201/bookings/ABC123');

    assert.equal(match.handler, handler);
    assert.deepEqual(match.params, { eventId: 'event 1', reference: 'ABC123' });
  });

  it('does not match another method or path shape', () => {
    const router = new Router().add('GET', '/events/:eventId', () => {});
    assert.equal(router.match('POST', '/events/one'), undefined);
    assert.equal(router.match('GET', '/events'), undefined);
    assert.equal(router.match('GET', '/events/one/bookings'), undefined);
  });

  it('rejects invalid route definitions with VALIDATION', () => {
    assert.throws(
      () => new Router().add('GET', 'events', () => {}),
      (error) => error instanceof DomainError && error.code === 'VALIDATION',
    );
    assert.throws(
      () => new Router().add('GET', '/events/:', () => {}),
      (error) => error instanceof DomainError && error.code === 'VALIDATION',
    );
  });

  it('reports malformed parameter encoding as VALIDATION', () => {
    const router = new Router().add('GET', '/events/:eventId', () => {});
    assert.throws(
      () => router.match('GET', '/events/%E0%A4%A'),
      (error) => error instanceof DomainError && error.code === 'VALIDATION',
    );
  });
});
