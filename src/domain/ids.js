import { randomBytes, randomUUID } from 'node:crypto';
import { DomainError } from './errors.js';

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newId() {
  return randomUUID();
}

export function newReference(length = 8) {
  if (!Number.isSafeInteger(length) || length < 1 || length > 128) {
    throw new DomainError('VALIDATION', 'Reference length must be a whole number from 1 to 128');
  }

  const bytes = randomBytes(length);
  let reference = '';
  for (const byte of bytes) {
    reference += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  }
  return reference;
}
