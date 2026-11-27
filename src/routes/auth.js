import { DomainError } from '../domain/errors.js';
import { signup, login } from '../services/authService.js';
import { requireUser } from '../http/guards.js';
import { createRouter } from '../http/router.js';
import { createRateLimiter } from '../lib/rateLimit.js';

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export function registerAuthRoutes(
  router,
  repository,
  loginRateLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 }),
) {
  if (!repository?.users) throw new DomainError('VALIDATION', 'A repository is required');
  router.add('POST', '/api/auth/signup', async (request, response) => {
    sendJson(response, 201, await signup(repository, request.body));
  });
  router.add('POST', '/api/auth/login', async (request, response) => {
    if (!loginRateLimiter.allow(request.socket?.remoteAddress ?? 'unknown')) {
      throw new DomainError('RATE_LIMITED', 'Too many login attempts. Try again later.');
    }
    sendJson(response, 200, await login(repository, request.body));
  });
  router.add('GET', '/api/auth/me', async (request, response) => {
    const payload = requireUser(request);
    const user = await repository.users.findById(payload.sub);
    if (!user) throw new DomainError('UNAUTHENTICATED', 'The authenticated user was not found');
    sendJson(response, 200, { id: user.id, email: user.email, role: user.role });
  });
  return router;
}

export function createAuthRouter({ repository } = {}) {
  return registerAuthRoutes(createRouter(), repository);
}
