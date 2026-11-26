export function createClock(now = () => new Date()) {
  if (typeof now !== 'function') throw new TypeError('Clock source must be a function');
  return Object.freeze({
    now() {
      const value = now();
      const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
      if (Number.isNaN(date.getTime())) throw new TypeError('Clock returned an invalid date');
      return date;
    },
  });
}

export const systemClock = createClock();
