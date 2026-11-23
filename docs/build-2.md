# Build 2: Search, sorting, and first tests

## Goal

Add pure event-search and sorting functions to the domain core. Filtering and
sorting return new lists and never mutate the input. Use a hand-written,
stable merge sort and Node's built-in test runner; no outside packages are
needed.

## Deliverables

- `src/domain/sorting.js`: a stable `mergeSort(items, compare)`.
- `src/domain/eventSearch.js`: `filterEvents`, `sortEvents`, and `searchEvents`.
- Inventory support for publishing events and listing event summaries.
- Node test-runner coverage in `test/`.
- An `npm test` script that runs the workspace's tests.

## Event summaries

Search and sorting work with event summary objects. The workspace implementation
uses these fields:

- `id`, `title`, `city`, `venue`, and `startsAt`.
- `minPriceCents`: cheapest ticket-tier price, or `null` when the event has no
  ticket tiers.
- `seatsLeft`: total remaining seats across ticket tiers.

Inventory summaries may also include `status`, `tierCount`, and
`maxPriceCents`.

## Acceptance criteria

### Merge sort

- Sort items using the supplied comparison function; do not call
  `Array.prototype.sort`.
- Preserve the original order of items that compare equally.
- Return a new array, including for empty and single-item inputs.
- Do not modify the input array.

### Publishing and summaries

- Publishing an event with no ticket tiers throws a `DomainError` with code
  `INVALID_STATE` and leaves the event unpublished.
- Publishing an event with at least one ticket tier changes its status to
  `published`.
- `listEventSummaries(store)` hides draft events by default.
- `listEventSummaries(store, { publishedOnly: false })` includes drafts.
- Each summary reports the cheapest tier price and total seats left.

### Filtering

`filterEvents(summaries, criteria)` supports:

- `q`: case-insensitive substring match in the event title or venue.
- `city`: case-insensitive exact match.
- `from` and `to`: inclusive date bounds. A date-only `to` includes the whole
  day.
- `maxPriceCents`: maximum allowed cheapest-tier price. Events with no tiers
  are excluded when this filter is active.
- `onlyAvailable`: when `true`, excludes events with no seats left.

Filtering returns a new list and does not mutate the provided list or its event
objects. Invalid criteria, dates, or non-whole-number prices throw a
`DomainError` with code `VALIDATION`.

### Sorting and combined search

`sortEvents(summaries, sortBy)` supports:

- `date`: earliest event first.
- `price`: cheapest first; events without a price go last.
- `availability`: most seats left first.

All sort modes break ties by title, then ID. An unknown sort key throws a
`DomainError` with code `VALIDATION`. `searchEvents(summaries, criteria,
sortBy)` filters first and then sorts.

## Test expectations

Use `node:test` and `node:assert/strict`. Cover the criteria above, including:

- Stable sorting, new-array results, and unchanged input arrays.
- Empty input for filtering and sorting.
- Case-insensitive title, venue, and city matching.
- Inclusive date ranges and date-only end dates.
- Price and availability filtering and sort order.
- Invalid inputs and expected `DomainError` codes.
- Publishing and public visibility of draft events.
- Combined filtering and sorting.

## Verification

```text
npm test
```
