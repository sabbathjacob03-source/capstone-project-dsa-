# Build 4 API examples

The server defaults to `http://localhost:3000`. Every mutation requires an
`x-user-id` header until authentication is added in Build 7. These PowerShell
examples use `curl.exe` and placeholder IDs; replace `EVENT_ID`, `TIER_ID`, and
`BOOKING_REFERENCE` with values returned by earlier calls.

## 1. Create an event

```powershell
curl.exe -X POST "http://localhost:3000/api/events" `
  -H "x-user-id: organizer-1" `
  -H "Content-Type: application/json" `
  -d '{"title":"Lagos Tech Meetup","city":"Lagos","venue":"Yaba Hub","startsAt":"2027-01-15T17:00:00Z"}'
```

## 2. Add a ticket tier

```powershell
curl.exe -X POST "http://localhost:3000/api/events/EVENT_ID/tiers" `
  -H "x-user-id: organizer-1" `
  -H "Content-Type: application/json" `
  -d '{"name":"General","priceCents":500000,"capacity":100}'
```

## 3. Publish the event

```powershell
curl.exe -X POST "http://localhost:3000/api/events/EVENT_ID/publish" `
  -H "x-user-id: organizer-1"
```

## 4. Search events

```powershell
curl.exe "http://localhost:3000/api/events?city=Lagos&maxPriceCents=600000&onlyAvailable=true&sortBy=price"
```

Supported query parameters are `q`, `city`, `from`, `to`, `maxPriceCents`,
`onlyAvailable`, and `sortBy` (`date`, `price`, or `availability`).

## 5. Book tickets

```powershell
curl.exe -X POST "http://localhost:3000/api/bookings" `
  -H "x-user-id: attendee-1" `
  -H "Content-Type: application/json" `
  -d '{"tierId":"TIER_ID","quantity":2}'
```

Save the returned booking `reference` for payment or cancellation.

## 6. Pay for a booking

Successful mock payment:

```powershell
curl.exe -X POST "http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay" `
  -H "x-user-id: attendee-1" `
  -H "Content-Type: application/json" `
  -d '{}'
```

Ask the mock gateway to decline the payment:

```powershell
curl.exe -X POST "http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay" `
  -H "x-user-id: attendee-1" `
  -H "Content-Type: application/json" `
  -d '{"decline":true}'
```

A declined payment returns `PAYMENT_DECLINED` and leaves the booking pending.

## 7. Cancel an unpaid booking

```powershell
curl.exe -X POST "http://localhost:3000/api/bookings/BOOKING_REFERENCE/cancel" `
  -H "x-user-id: attendee-1"
```

Only the attendee who created a booking can pay for or cancel it. Build 4 allows
cancellation only while a booking is pending.
