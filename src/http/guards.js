import { DomainError } from '../domain/errors.js';
import { verifyToken } from '../lib/token.js';

export function requireUser(request) {
  const authorization = request.headers.authorization;
  if (typeof authorization !== 'string') {
    throw new DomainError('UNAUTHENTICATED', 'A bearer token is required');
  }
  const match = /^Bearer ([^\s]+)$/i.exec(authorization.trim());
  if (!match) throw new DomainError('UNAUTHENTICATED', 'A bearer token is required');
  const payload = verifyToken(match[1]);
  if (!payload || typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
    throw new DomainError('UNAUTHENTICATED', 'The bearer token is missing or invalid');
  }
  request.user = payload;
  return payload;
}

export function requireRole(...roles) {
  return function guardedRole(request) {
    const user = requireUser(request);
    if (!roles.includes(user.role)) {
      throw new DomainError('FORBIDDEN', 'You do not have permission to perform this action');
    }
    return user;
  };
}
