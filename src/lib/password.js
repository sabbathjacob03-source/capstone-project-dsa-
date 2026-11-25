import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt}:${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
  const separator = storedHash.indexOf(':');
  if (separator <= 0) return false;
  const salt = storedHash.slice(0, separator);
  const expectedHex = storedHash.slice(separator + 1);
  if (!/^[a-f0-9]+$/i.test(salt) || !/^[a-f0-9]+$/i.test(expectedHex)) return false;
  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = Buffer.from(await scryptAsync(password, salt, expected.length));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
