import { DomainError } from '../domain/errors.js';
import { signup, login } from '../services/authService.js';
import { requireUser } from '../http/guards.js';
import { createRouter } from '../http/router.js';

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export function registerAuthRoutes(router, repository) {
  if (!repository?.users) throw new DomainError('VALIDATION', 'A repository is required');
  router.add('POST', '/api/auth/signup', async (request, response) => {
    sendJson(response, 201, await signup(repository, request.body));
  });
  router.add('POST', '/api/auth/login', async (request, response) => {
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
