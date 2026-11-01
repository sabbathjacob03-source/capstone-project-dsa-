import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../src/domain/errors.js';
import { newId, newReference } from '../src/domain/ids.js';

describe('ids', () => {
  it('creates UUIDs', () => {
    assert.match(newId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('creates short references without ambiguous characters', () => {
    assert.match(newReference(), /^[A-HJ-NP-Z2-9]{8}$/);
    assert.equal(newReference(12).length, 12);
  });

  it('validates reference lengths with a DomainError', () => {
    for (const length of [0, -1, 1.5, 129, '8']) {
      assert.throws(
        () => newReference(length),
        (error) => error instanceof DomainError && error.code === 'VALIDATION',
      );
    }
  });
});
