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

  return Object.freeze({
    events,
    tiers,
    bookings,
  });
}
