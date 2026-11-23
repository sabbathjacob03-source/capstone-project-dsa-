import { listEvents } from '../api.js';
import { el, formatPrice } from '../ui.js';

const filters = document.querySelector('#filters');
const eventContainer = document.querySelector('#events');
const citySelect = document.querySelector('#city');
const resultsCount = document.querySelector('#results-count');

function formatDate(value) {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}

function eventCard(event) {
  const cheapest = Math.min(...event.tiers.map((tier) => tier.priceCents));
  const totalSeats = event.tiers.reduce((sum, tier) => sum + tier.seatsLeft, 0);
  return el('article', { className: 'event-card' }, [
    el('div', { className: 'event-card-accent' }),
    el('div', { className: 'event-card-body' }, [
      el('p', { className: 'event-city', textContent: event.city }),
      el('h2', { className: 'event-title', textContent: event.title }),
      el('p', { className: 'event-meta', textContent: event.venue }),
      el('p', { className: 'event-meta', textContent: formatDate(event.startsAt) }),
      el('div', { className: 'event-card-footer' }, [
        el('div', {}, [
          el('span', { className: 'muted', textContent: 'From' }),
          el('strong', { textContent: formatPrice(cheapest) }),
        ]),
        el('div', { className: 'availability' }, [
          el('span', { className: 'availability-dot' }),
          el('span', { textContent: totalSeats ? `${totalSeats} seats left` : 'Sold out' }),
        ]),
      ]),
      el('a', {
        href: `/event.html?id=${encodeURIComponent(event.id)}`,
        className: 'card-action',
      }, 'View event'),
    ]),
  ]);
}

async function render() {
  const criteria = Object.fromEntries(new FormData(filters).entries());
  eventContainer.replaceChildren();
  resultsCount.textContent = 'Loading events...';
  try {
    const events = await listEvents(criteria);
    resultsCount.textContent = `${events.length} ${events.length === 1 ? 'event' : 'events'} found`;
    if (!events.length) {
      eventContainer.appendChild(el('p', { className: 'empty-state', textContent: 'No events match your filters.' }));
      return;
    }
    events.forEach((event) => eventContainer.appendChild(eventCard(event)));
  } catch (error) {
    resultsCount.textContent = '';
    eventContainer.appendChild(el('p', { className: 'error', textContent: error.message }));
  }
}

async function initialise() {
  await render();
  const events = await listEvents();
  [...new Set(events.map((event) => event.city))].sort().forEach((city) => {
    citySelect.appendChild(el('option', { value: city, textContent: city }));
  });
}

filters.addEventListener('input', render);
filters.addEventListener('change', render);
filters.addEventListener('submit', (event) => {
  event.preventDefault();
  render();
});

initialise();
