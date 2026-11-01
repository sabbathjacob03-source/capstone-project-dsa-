import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BOOKING_STATES, BOOKING_TRANSITIONS, assertTransition, canTransition } from '../src/domain/bookingStateMachine.js';
import { DomainError } from '../src/domain/errors.js';

describe('booking state machine', () => {
  it('allows every defined transition', () => {
    for (const from of BOOKING_STATES) {
      for (const to of BOOKING_TRANSITIONS[from]) {
        assert.equal(canTransition(from, to), true, `${from} -> ${to}`);
        assert.doesNotThrow(() => assertTransition(from, to));
      }
    }
  });

  it('rejects every transition not explicitly allowed', () => {
    for (const from of BOOKING_STATES) {
      for (const to of BOOKING_STATES) {
        if (BOOKING_TRANSITIONS[from].includes(to)) continue;
        assert.equal(canTransition(from, to), false, `${from} -> ${to}`);
        assert.throws(
          () => assertTransition(from, to),
          (error) => error instanceof DomainError && error.code === 'INVALID_TRANSITION',
          `${from} -> ${to}`,
        );
      }
    }
  });

  it('rejects unknown states', () => {
    assert.equal(canTransition('unknown', 'paid'), false);
    assert.equal(canTransition('pending', 'unknown'), false);
    assert.throws(
      () => assertTransition('unknown', 'paid'),
      (error) => error instanceof DomainError && error.code === 'INVALID_TRANSITION',
    );
  });
});
