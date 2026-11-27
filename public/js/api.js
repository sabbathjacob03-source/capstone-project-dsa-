import { getToken, clearSession } from './session.js';

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(path, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const value = await response.json();
  if (!response.ok) {
    if (response.status === 401 && token) clearSession();
    const error = new Error(value.error?.message ?? 'The request failed');
    error.code = value.error?.code;
    error.checkedInAt = value.error?.checkedInAt;
    throw error;
  }
  return value;
}

export function signup(input) {
  return request('/api/auth/signup', { method: 'POST', body: input });
}

export function login(input) {
  return request('/api/auth/login', { method: 'POST', body: input });
}

export function getCurrentUser() {
  return request('/api/auth/me');
}

export function listEvents(criteria = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(criteria)) {
    if (value !== '' && value !== undefined && value !== null) params.set(key, String(value));
  }
  const query = params.toString();
  return request(`/api/events${query ? `?${query}` : ''}`);
}

export function getEvent(eventId) {
  return request(`/api/events/${encodeURIComponent(eventId)}`);
}

export function createEvent(input) {
  return request('/api/events', { method: 'POST', body: input });
}

export function listMyEvents() {
  return request('/api/events/mine');
}

export function createTier(eventId, input) {
  return request(`/api/events/${encodeURIComponent(eventId)}/tiers`, { method: 'POST', body: input });
}

export function publishEvent(eventId) {
  return request(`/api/events/${encodeURIComponent(eventId)}/publish`, { method: 'POST' });
}

export function createBooking(input) {
  return request('/api/bookings', { method: 'POST', body: input });
}

export function listBookings() {
  return request('/api/bookings');
}

export function checkInTicket(code) {
  return request('/api/checkin', { method: 'POST', body: { code } });
}

export function getBooking(reference) {
  return request(`/api/bookings/${encodeURIComponent(reference)}`);
}

export function cancelBooking(reference) {
  return request(`/api/bookings/${encodeURIComponent(reference)}/cancel`, { method: 'POST' });
}

export function previewRefund(reference) {
  return request(`/api/bookings/${encodeURIComponent(reference)}/refund`);
}

export function joinWaitlist(input) {
  return request('/api/waitlist', { method: 'POST', body: input });
}

export function listWaitlistOffers() {
  return request('/api/waitlist/offers');
}

export function acceptWaitlistOffer(id) {
  return request(`/api/waitlist/offers/${encodeURIComponent(id)}/accept`, { method: 'POST' });
}

export function pay(referenceOrBooking, options = {}) {
  const reference = typeof referenceOrBooking === 'string' ? referenceOrBooking : referenceOrBooking.reference;
  return request(`/api/bookings/${encodeURIComponent(reference)}/pay`, {
    method: 'POST',
    body: options,
  });
}
