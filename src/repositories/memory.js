import { DomainError } from '../domain/errors.js';

function createCollection() {
  const records = new Map();
  const references = new Map();

  return Object.freeze({
    async findById(id) {
      return records.get(id);
    },
    async findByReference(reference) {
      return references.get(reference);
    },
    async list() {
      return [...records.values()];
    },
    async save(record) {
      if (!record || typeof record.id !== 'string' || record.id.trim() === '') {
        throw new TypeError('A record with an id is required');
      }
      const previous = records.get(record.id);
      if (previous?.reference) references.delete(previous.reference);
      records.set(record.id, record);
      if (record.reference) references.set(record.reference, record);
      return record;
    },
  });
}

export function createMemoryRepository() {
  const events = createCollection();
  const tiers = createCollection();
  const bookings = createCollection();
  const usersById = new Map();
  const usersByEmail = new Map();
  const users = Object.freeze({
    async findById(id) {
      return usersById.get(id);
    },
    async findByEmail(email) {
      return usersByEmail.get(String(email).toLowerCase());
    },
    async list() {
      return [...usersById.values()];
    },
    async save(user) {
      usersById.set(user.id, user);
      usersByEmail.set(user.email.toLowerCase(), user);
      return user;
    },
  });

  return Object.freeze({
    events,
    tiers,
    bookings,
    users,
    async reserveBooking(booking) {
      const tier = await tiers.findById(booking.tierId);
      if (!tier || tier.sold + booking.quantity > tier.capacity) {
        throw new DomainError('SOLD_OUT', 'The requested tickets are sold out');
      }
      tier.sold += booking.quantity;
      await tiers.save(tier);
      await bookings.save(booking);
      return booking;
    },
  });
}
