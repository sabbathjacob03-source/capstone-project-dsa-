# AI log

## Build 6

### Prompt 1: Build 6 frontend on mock data
- **What I asked:** Build event browsing and checkout with plain HTML, CSS, browser ES modules, mock data/API functions, filters, sold-out tiers, countdown, and mock payment retry.
- **What came back:** A responsive browse page and event checkout page, shared DOM/price helpers, mock API promises, quantity limits, countdown, and declined-card error handling.
- **What was wrong (or "nothing"):** Nothing after implementation. The decline rule is implemented by treating card numbers ending in `0002` as declined; this convention was added where no exact card number was specified.

## Build 7

### Prompt 1: Build 7 authentication and roles
- **What I asked:** Add password hashing and bearer-token authentication, three server-checked roles, private booking and organizer ownership rules, connected frontend pages, and tests.
- **What came back:** Scrypt password storage, HS256 tokens, signup/login/me routes, role guards, ownership checks, fetch-based frontend pages, and auth tests.
- **What was wrong (or "nothing"):** The first direct-service compatibility pass changed addTier and publish signatures in a way that broke existing direct service tests. Added overload-compatible calls so HTTP ownership checks remain strict while existing direct service tests continue to work.
