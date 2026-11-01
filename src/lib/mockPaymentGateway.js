import { DomainError } from '../domain/errors.js';

export async function charge(request = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new DomainError('VALIDATION', 'Payment request must be an object');
  }
  if (request.decline !== undefined && typeof request.decline !== 'boolean') {
    throw new DomainError('VALIDATION', 'Payment decline flag must be a boolean');
  }

  return request.decline
    ? { status: 'declined' }
    : { status: 'succeeded' };
}
