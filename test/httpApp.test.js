import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/http/app.js';

describe('HTTP app', () => {
  const server = createApp();
  let baseUrl;

  server.listen(0, '127.0.0.1');
  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  it('answers a real GET /health request with JSON', async () => {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(await response.json(), { status: 'ok' });
  });

  it('returns a consistent JSON 404 for an unknown API route', async () => {
    const response = await fetch(`${baseUrl}/api/unknown`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: { code: 'NOT_FOUND', message: 'API route not found' },
    });
  });

  it('returns a JSON 400 for malformed JSON', async () => {
    const response = await fetch(`${baseUrl}/api/unknown`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid',
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON' },
    });
  });

  it('serves the public index and does not expose files outside public', async () => {
    const index = await fetch(`${baseUrl}/`);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /Event Ticketing Capstone/);

    const outside = await fetch(`${baseUrl}/%2e%2e%2fpackage.json`);
    assert.equal(outside.status, 404);
    assert.deepEqual(await outside.json(), {
      error: { code: 'NOT_FOUND', message: 'File not found' },
    });
  });
});
