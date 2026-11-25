import { DomainError } from '../domain/errors.js';
import { newId } from '../domain/ids.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signToken } from '../lib/token.js';

const VALID_ROLES = new Set(['attendee', 'organizer', 'staff']);

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${label} is required`);
  }
  return value.trim();
}

function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role };
}

export async function signup(repository, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new DomainError('VALIDATION', 'Signup data must be an object');
  }
  const email = requireText(input.email, 'Email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DomainError('VALIDATION', 'Email must be a valid address');
  }
  if (typeof input.password !== 'string' || input.password.length < 8) {
    throw new DomainError('VALIDATION', 'Password must be at least 8 characters');
  }
  if (!VALID_ROLES.has(input.role)) {
    throw new DomainError('VALIDATION', 'Role must be attendee, organizer or staff');
  }
  if (await repository.users.findByEmail(email)) {
    throw new DomainError('EMAIL_TAKEN', 'An account with this email already exists');
  }
  const user = {
    id: newId(),
    email,
    passwordHash: await hashPassword(input.password),
    role: input.role,
    createdAt: new Date().toISOString(),
  };
  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  await repository.users.save(user);
  return { token, user: publicUser(user) };
}

export async function login(repository, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new DomainError('VALIDATION', 'Login data must be an object');
  }
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const user = await repository.users.findByEmail(email);
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!valid) {
    throw new DomainError('INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  return { token, user: publicUser(user) };
}
