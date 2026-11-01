import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../src/domain/errors.js';
import { mergeSort } from '../src/domain/sorting.js';

describe('mergeSort', () => {
  it('sorts without mutating the input and returns a new array', () => {
    const input = [4, 1, 3, 2];
    const result = mergeSort(input, (left, right) => left - right);
    assert.deepEqual(result, [1, 2, 3, 4]);
    assert.deepEqual(input, [4, 1, 3, 2]);
    assert.notEqual(result, input);
  });

  it('is stable when items compare equally', () => {
    const input = [
      { key: 1, name: 'first' },
      { key: 0, name: 'middle' },
      { key: 1, name: 'second' },
    ];
    const result = mergeSort(input, (left, right) => left.key - right.key);
    assert.deepEqual(result.map((item) => item.name), ['middle', 'first', 'second']);
  });

  it('handles empty and single-item inputs', () => {
    const empty = [];
    const single = [1];
    assert.deepEqual(mergeSort(empty, () => 0), []);
    assert.notEqual(mergeSort(empty, () => 0), empty);
    assert.deepEqual(mergeSort(single, () => 0), [1]);
    assert.notEqual(mergeSort(single, () => 0), single);
  });

  it('rejects invalid arguments with VALIDATION', () => {
    assert.throws(() => mergeSort(null, () => 0), (error) =>
      error instanceof DomainError && error.code === 'VALIDATION');
    assert.throws(() => mergeSort([], null), (error) =>
      error instanceof DomainError && error.code === 'VALIDATION');
  });
});
