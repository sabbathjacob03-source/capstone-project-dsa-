import { createHmac, timingSafeEqual } from 'node:crypto';

function secretFromEnvironment(explicitSecret) {
  const secret = explicitSecret ?? process.env.TOKEN_SECRET ?? process.env.JWT_SECRET ?? process.env.AUTH_SECRET;
  if (typeof secret !== 'string' || secret.trim() === '') {
    throw new Error('A TOKEN_SECRET environment variable is required');
  }
  return secret;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function signature(input, secret) {
  return createHmac('sha256', secret).update(input).digest();
}

export function signToken(payload, secret, options = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Token payload must be an object');
  }
  let signingSecret;
  let lifetimeOptions = options;
  if (typeof secret === 'string') {
    signingSecret = secretFromEnvironment(secret);
  } else if (secret && typeof secret === 'object') {
    signingSecret = secretFromEnvironment(undefined);
    lifetimeOptions = secret;
  } else {
    signingSecret = secretFromEnvironment(undefined);
  }
  const lifetime = typeof lifetimeOptions === 'number'
    ? lifetimeOptions
    : (lifetimeOptions.expiresInSeconds ?? 3600);
  if (!Number.isSafeInteger(lifetime)) {
    throw new TypeError('Token lifetime must be a whole number of seconds');
  }
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + lifetime };
  const input = `${encode(header)}.${encode(body)}`;
  return `${input}.${signature(input, signingSecret).toString('base64url')}`;
}

export function verifyToken(token, secret) {
  if (typeof token !== 'string') return null;
  const signingSecret = secretFromEnvironment(secret);
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  try {
    const header = decode(headerPart);
    if (!header || header.alg !== 'HS256') return null;
    const input = `${headerPart}.${payloadPart}`;
    const expected = signature(input, signingSecret);
    const actual = Buffer.from(signaturePart, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const payload = decode(payloadPart);
    if (!payload || typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const sign = signToken;
export const verify = verifyToken;
