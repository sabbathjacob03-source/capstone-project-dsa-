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

export async function refund(request = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new DomainError('VALIDATION', 'Refund request must be an object');
  }
  if (!Number.isSafeInteger(request.amountCents) || request.amountCents < 0) {
    throw new DomainError('VALIDATION', 'Refund amount must be a non-negative whole number of cents');
  }
  return { status: 'succeeded', amountCents: request.amountCents };
}
