import { createHmac, timingSafeEqual } from 'node:crypto';

function signingSecret(secret) {
  const value = secret ?? process.env.TICKET_TOKEN_SECRET;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('TICKET_TOKEN_SECRET is required');
  }
  return value;
}

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest();
}

export function signTicketToken(reference, secret) {
  if (typeof reference !== 'string' || reference.trim() === '') {
    throw new TypeError('A booking reference is required');
  }
  const payload = Buffer.from(JSON.stringify({
    reference,
    iat: Math.floor(Date.now() / 1000),
  })).toString('base64url');
  return `${payload}.${signature(payload, signingSecret(secret)).toString('base64url')}`;
}

export function verifyTicketToken(token, secret) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadPart, signaturePart] = parts;
  let actualSignature;
  try {
    actualSignature = Buffer.from(signaturePart, 'base64url');
  } catch {
    return null;
  }
  const expectedSignature = signature(payloadPart, signingSecret(secret));
  if (
    actualSignature.length !== expectedSignature.length ||
    actualSignature.toString('base64url') !== signaturePart ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    Object.keys(payload).length !== 2 ||
    typeof payload.reference !== 'string' ||
    payload.reference.trim() === '' ||
    !Number.isSafeInteger(payload.iat) ||
    payload.iat < 0
  ) {
    return null;
  }
  return payload;
}
