import { createServer } from 'node:http';
import { realpath, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DomainError } from '../domain/errors.js';
import { createRouter } from './router.js';

const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));
const MAX_JSON_BODY_BYTES = 1_048_576;
const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function sendError(response, statusCode, code, message) {
  sendJson(response, statusCode, { error: { code, message } });
}

function statusFor(error) {
  if (error instanceof DomainError) {
    if (error.code === 'VALIDATION' || error.code === 'INVALID_JSON') return 400;
    if (error.code === 'NOT_FOUND') return 404;
    if (error.code === 'PAYLOAD_TOO_LARGE') return 413;
  }
  return 500;
}

async function parseJsonBody(request) {
  const contentType = request.headers['content-type']?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') return;

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new DomainError('PAYLOAD_TOO_LARGE', 'JSON request body is too large');
    }
    chunks.push(chunk);
  }

  try {
    request.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new DomainError('INVALID_JSON', 'Request body must contain valid JSON');
  }
}

function isWithinDirectory(directory, target) {
  const relative = path.relative(directory, target);
  return relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative));
}

async function servePublicFile(request, response, pathname, publicDir) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw new DomainError('VALIDATION', 'Path contains invalid URL encoding');
  }

  const root = await realpath(publicDir);
  const requestedPath = decodedPath === '/'
    ? 'index.html'
    : decodedPath.replace(/^[/\\]+/, '');
  const target = path.resolve(root, requestedPath);
  if (!isWithinDirectory(root, target)) {
    throw new DomainError('NOT_FOUND', 'File not found');
  }

  let actualPath;
  try {
    actualPath = await realpath(target);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      throw new DomainError('NOT_FOUND', 'File not found');
    }
    throw error;
  }
  if (!isWithinDirectory(root, actualPath)) {
    throw new DomainError('NOT_FOUND', 'File not found');
  }

  const fileInfo = await stat(actualPath);
  if (!fileInfo.isFile()) throw new DomainError('NOT_FOUND', 'File not found');

  response.writeHead(200, {
    'content-type': MIME_TYPES.get(path.extname(actualPath).toLowerCase()) ?? 'application/octet-stream',
    'content-length': fileInfo.size,
  });
  if (request.method === 'HEAD') {
    response.end();
  } else {
    response.end(await readFile(actualPath));
  }
  return true;
}

export function createApp({ router = createRouter(), publicDir = DEFAULT_PUBLIC_DIR } = {}) {
  if (!router || typeof router.match !== 'function') {
    throw new DomainError('VALIDATION', 'A compatible router is required');
  }
  if (typeof publicDir !== 'string' || publicDir.trim() === '') {
    throw new DomainError('VALIDATION', 'A public directory path is required');
  }

  router.add('GET', '/health', (_request, response) => {
    sendJson(response, 200, { status: 'ok' });
  });

  return createServer(async (request, response) => {
    try {
      await parseJsonBody(request);
      const url = new URL(request.url, 'http://localhost');
      const match = router.match(request.method, url.pathname);
      if (match) {
        await match.handler(request, response, match.params);
        if (!response.writableEnded) response.end();
        return;
      }

      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        sendError(response, 404, 'NOT_FOUND', 'API route not found');
        return;
      }

      if (await servePublicFile(request, response, url.pathname, publicDir)) return;
      sendError(response, 404, 'NOT_FOUND', 'Resource not found');
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      if (error instanceof DomainError) {
        sendError(response, statusFor(error), error.code, error.message);
        return;
      }
      sendError(response, 500, 'INTERNAL_ERROR', 'An internal server error occurred');
    }
  });
}
