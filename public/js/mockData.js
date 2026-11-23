export const events = [
  {
    id: 'evt-lagos-tech',
    title: 'Lagos Tech Meetup',
    city: 'Lagos',
    venue: 'Yaba Hub',
    startsAt: '2027-01-15T17:00:00Z',
    published: true,
    tiers: [
      { id: 'tier-lagos-general', name: 'General', priceCents: 500000, capacity: 100, seatsLeft: 42 },
      { id: 'tier-lagos-vip', name: 'VIP', priceCents: 1500000, capacity: 30, seatsLeft: 8 },
    ],
  },
  {
    id: 'evt-abuja-jazz',
    title: 'Abuja Jazz Night',
    city: 'Abuja',
    venue: 'The Jazz Arena',
    startsAt: '2027-02-05T19:30:00Z',
    published: true,
    tiers: [
      { id: 'tier-jazz-general', name: 'General', priceCents: 250000, capacity: 80, seatsLeft: 0 },
      { id: 'tier-jazz-vip', name: 'VIP', priceCents: 750000, capacity: 20, seatsLeft: 12 },
    ],
  },
  {
    id: 'evt-portharcourt-food',
    title: 'Port Harcourt Food Festival',
    city: 'Port Harcourt',
    venue: 'Garden City Grounds',
    startsAt: '2027-03-12T12:00:00Z',
    published: true,
    tiers: [
      { id: 'tier-food-standard', name: 'Standard', priceCents: 120000, capacity: 250, seatsLeft: 95 },
    ],
  },
];
