# Build 3: Architecture

## Layers

```mermaid
flowchart TD
  Client --> Routes
  Routes --> Services
  Services --> DomainRules
  Services --> Repositories
  Services --> PaymentGateway
  Repositories --> Database
```

- **Routes** may interpret HTTP input, call services, and format responses; they
  may not implement business rules or access persistence directly.
- **Services** may coordinate domain rules and repositories; they may not
  depend on HTTP request/response details or call routes. External integrations,
  such as the payment gateway, are accessed through service dependencies.
- **Domain rules** may validate and apply business decisions; they may not
  perform I/O or depend on services, repositories, or routes.
- **Repositories** may read and write persistence; they may not implement
  booking policy or depend on services or routes.

Dependencies point inward: routes call services, and services call domain
rules and repositories. Nothing calls upward into a higher layer.

## Data model

```mermaid
erDiagram
  USERS ||--o{ EVENTS : organizes
  EVENTS ||--|{ TICKET_TIERS : offers
  EVENTS ||--o{ BOOKINGS : receives
  USERS ||--o{ BOOKINGS : makes
  TICKET_TIERS ||--o{ BOOKINGS : reserves

  USERS {
    string id PK
    string name
    string email
  }
  EVENTS {
    string id PK
    string organizer_id FK
    string title
    string starts_at
    string status
  }
  TICKET_TIERS {
    string id PK
    string event_id FK
    string name
    integer price_cents
    integer capacity
  }
  BOOKINGS {
    string id PK
    string user_id FK
    string event_id FK
    string tier_id FK
    string reference
    integer quantity
    string status
  }
```

## Booking life cycle

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> paid
  pending --> cancelled
  paid --> checked_in
  paid --> refunded
  paid --> cancelled
  cancelled --> [*]
  refunded --> [*]
  checked_in --> [*]
```

Only the transitions shown are valid. Cancelled, refunded, and checked-in
bookings are final states.
