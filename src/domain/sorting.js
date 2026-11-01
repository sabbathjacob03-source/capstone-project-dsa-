import { DomainError } from './errors.js';

export function mergeSort(items, compare) {
  if (!Array.isArray(items)) {
    throw new DomainError('VALIDATION', 'Items must be an array');
  }
  if (typeof compare !== 'function') {
    throw new DomainError('VALIDATION', 'A comparison function is required');
  }

  function sortRange(start, end) {
    if (end - start <= 1) return items.slice(start, end);

    const middle = Math.floor((start + end) / 2);
    const left = sortRange(start, middle);
    const right = sortRange(middle, end);
    const merged = [];
    let leftIndex = 0;
    let rightIndex = 0;

    while (leftIndex < left.length && rightIndex < right.length) {
      if (compare(left[leftIndex], right[rightIndex]) <= 0) {
        merged.push(left[leftIndex]);
        leftIndex += 1;
      } else {
        merged.push(right[rightIndex]);
        rightIndex += 1;
      }
    }

    while (leftIndex < left.length) {
      merged.push(left[leftIndex]);
      leftIndex += 1;
    }
    while (rightIndex < right.length) {
      merged.push(right[rightIndex]);
      rightIndex += 1;
    }
    return merged;
  }

  return sortRange(0, items.length);
}
