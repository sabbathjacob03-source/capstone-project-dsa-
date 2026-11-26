import { DomainError } from '../domain/errors.js';

function createCollection() {
  const records = new Map();
  const references = new Map();

  return Object.freeze({
    getByIdSync(id) {
      return records.get(id);
    },
    getByReferenceSync(reference) {
      return references.get(reference);
    },
    listSync() {
      return [...records.values()];
    },
    mutateByReference(reference, update) {
      const record = references.get(reference);
      if (!record) return undefined;
      return update(record);
    },
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
  const waitlist = createCollection();

  function offerFreedSeats(tierId, quantity, now, offerDurationMs) {
    const queued = waitlist.listSync()
      .filter((entry) => entry.tierId === tierId && entry.status === 'waiting')
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const tier = tiers.getByIdSync(tierId);
    let remaining = quantity;
    for (const entry of queued) {
      if (remaining === 0 || !tier || tier.sold >= tier.capacity) break;
      tier.sold += 1;
      entry.status = 'offered';
      entry.offerExpiresAt = new Date(Date.parse(now) + offerDurationMs).toISOString();
      remaining -= 1;
    }
  }

  return Object.freeze({
    events,
    tiers,
    bookings,
    waitlist,
    users,
    async reserveBooking(booking) {
      const tier = tiers.getByIdSync(booking.tierId);
      if (!tier || tier.sold + booking.quantity > tier.capacity) {
        throw new DomainError('SOLD_OUT', 'The requested tickets are sold out');
      }
      tier.sold += booking.quantity;
      await bookings.save(booking);
      return booking;
    },
    async joinWaitlist(entry) {
      const tier = tiers.getByIdSync(entry.tierId);
      if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');
      if (tier.sold < tier.capacity) {
        throw new DomainError('NOT_SOLD_OUT', 'You can only join a waitlist for a sold-out tier');
      }
      if (waitlist.listSync().some((current) =>
        current.tierId === entry.tierId &&
        current.userId === entry.userId &&
        ['waiting', 'offered'].includes(current.status))) {
        throw new DomainError('ALREADY_ON_WAITLIST', 'You are already on this waitlist');
      }
      await waitlist.save(entry);
      return entry;
    },
    async claimBookingStatus(reference, userId, expectedStatus, nextStatus) {
      return bookings.mutateByReference(reference, (booking) => {
        if (booking.userId !== userId || booking.status !== expectedStatus) return undefined;
        booking.status = nextStatus;
        return booking;
      });
    },
    async restoreRefundClaim(reference, userId) {
      return bookings.mutateByReference(reference, (booking) => {
        if (booking.userId !== userId || booking.status !== 'refunding') return false;
        booking.status = 'paid';
        return true;
      }) ?? false;
    },
    async cancelBookingAndRelease({ reference, userId, expectedStatus, nextStatus, now, offerDurationMs, refundAmountCents = null }) {
      return bookings.mutateByReference(reference, (booking) => {
        if (booking.userId !== userId || booking.status !== expectedStatus) return undefined;
        const tier = tiers.getByIdSync(booking.tierId);
        if (!tier || tier.sold < booking.quantity) {
          throw new DomainError('INVALID_STATE', 'Releasing this booking would make sold inventory invalid');
        }
        booking.status = nextStatus;
        if (refundAmountCents !== null) booking.refundAmountCents = refundAmountCents;
        tier.sold -= booking.quantity;
        offerFreedSeats(tier.id, booking.quantity, now, offerDurationMs);
        return booking;
      });
    },
    async completeRefund({ reference, userId, now, offerDurationMs, refundAmountCents }) {
      return bookings.mutateByReference(reference, (booking) => {
        if (booking.userId !== userId || booking.status !== 'refunding') return undefined;
        const tier = tiers.getByIdSync(booking.tierId);
        if (!tier || tier.sold < booking.quantity) {
          throw new DomainError('INVALID_STATE', 'Releasing this booking would make sold inventory invalid');
        }
        booking.status = 'refunded';
        booking.refundAmountCents = refundAmountCents;
        tier.sold -= booking.quantity;
        offerFreedSeats(tier.id, booking.quantity, now, offerDurationMs);
        return booking;
      });
    },
    async expirePendingBookings({ now, holdDurationMs, offerDurationMs }) {
      let expiredCount = 0;
      for (const booking of bookings.listSync()) {
        const expiry = booking.holdExpiresAt ??
          new Date(Date.parse(booking.createdAt) + holdDurationMs).toISOString();
        if (booking.status !== 'pending' || Date.parse(expiry) > Date.parse(now)) continue;
        const result = await this.cancelBookingAndRelease({
          reference: booking.reference,
          userId: booking.userId,
          expectedStatus: 'pending',
          nextStatus: 'cancelled',
          now,
          offerDurationMs,
        });
        if (result) expiredCount += 1;
      }
      return expiredCount;
    },
    async expireWaitlistOffers({ now, offerDurationMs }) {
      let expiredCount = 0;
      for (const entry of waitlist.listSync()) {
        if (entry.status !== 'offered' || Date.parse(entry.offerExpiresAt) > Date.parse(now)) continue;
        const tier = tiers.getByIdSync(entry.tierId);
        if (!tier || tier.sold < 1) {
          throw new DomainError('INVALID_STATE', 'Expiring this offer would make sold inventory invalid');
        }
        entry.status = 'expired';
        tier.sold -= 1;
        offerFreedSeats(tier.id, 1, now, offerDurationMs);
        expiredCount += 1;
      }
      return expiredCount;
    },
    async acceptWaitlistOffer({ id, userId, now, booking, offerDurationMs }) {
      const entry = waitlist.getByIdSync(id);
      if (!entry || entry.userId !== userId) return { notFound: true };
      if (entry.status !== 'offered') return { invalid: true };
      if (Date.parse(entry.offerExpiresAt) <= Date.parse(now)) {
        const tier = tiers.getByIdSync(entry.tierId);
        if (!tier || tier.sold < 1) {
          throw new DomainError('INVALID_STATE', 'Expiring this offer would make sold inventory invalid');
        }
        entry.status = 'expired';
        tier.sold -= 1;
        offerFreedSeats(tier.id, 1, now, offerDurationMs);
        return { expired: true };
      }
      entry.status = 'accepted';
      entry.offerExpiresAt = null;
      await bookings.save(booking);
      return { booking };
    },
  });
}
