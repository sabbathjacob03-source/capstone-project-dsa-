# AI log

## Build 6

### Prompt 1: Build 6 frontend on mock data
- **What I asked:** Build event browsing and checkout with plain HTML, CSS, browser ES modules, mock data/API functions, filters, sold-out tiers, countdown, and mock payment retry.
- **What came back:** A responsive browse page and event checkout page, shared DOM/price helpers, mock API promises, quantity limits, countdown, and declined-card error handling.
- **What was wrong (or "nothing"):** Nothing after implementation. The decline rule is implemented by treating card numbers ending in `0002` as declined; this convention was added where no exact card number was specified.
