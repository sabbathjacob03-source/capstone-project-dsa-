import { createBooking, getEvent, pay } from '../api.js';
import { el, formatPrice } from '../ui.js';

const eventDetails = document.querySelector('#event-details');
const checkout = document.querySelector('#checkout');
const holdStatus = document.querySelector('#hold-status');
const bookingSummary = document.querySelector('#booking-summary');
const paymentForm = document.querySelector('#payment-form');
const paymentError = document.querySelector('#payment-error');

let currentBooking = null;
let countdownTimer = null;

function formatDate(value) {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value));
}

function showActionError(container, message) {
  container.querySelector('.action-error')?.remove();
  container.appendChild(el('p', { className: 'error action-error', textContent: message }));
}

function tierCard(tier) {
  const soldOut = tier.seatsLeft <= 0;
  const quantityLabel = el('label', { for: `quantity-${tier.id}`, textContent: 'Quantity' });
  const quantity = el('input', {
    id: `quantity-${tier.id}`,
    name: `quantity-${tier.id}`,
    type: 'number',
    min: '1',
    max: String(Math.min(10, tier.seatsLeft)),
    value: '1',
    disabled: soldOut,
  });
  const button = el('button', {
    type: 'button',
    className: 'primary-button',
    textContent: soldOut ? 'Sold out' : 'Choose tickets',
    disabled: soldOut,
  });
  const card = el('article', { className: `tier-card${soldOut ? ' sold-out' : ''}` }, [
    el('div', {}, [
      el('h3', { textContent: tier.name }),
      el('p', { className: soldOut ? 'sold-out-label' : 'seat-count', textContent: soldOut ? 'Sold out' : `${tier.seatsLeft} seats left` }),
    ]),
    el('strong', { className: 'tier-price', textContent: formatPrice(tier.priceCents) }),
    el('div', { className: 'quantity-control' }, [quantityLabel, quantity]),
    button,
  ]);

  button.addEventListener('click', async () => {
    const requestedQuantity = Number(quantity.value);
    const limit = Math.min(10, tier.seatsLeft);
    if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
      showActionError(card, 'Choose at least one ticket.');
      return;
    }
    if (requestedQuantity > limit) {
      showActionError(card, `You can choose at most ${limit} tickets.`);
      return;
    }
    button.disabled = true;
    try {
      currentBooking = await createBooking({ tierId: tier.id, quantity: requestedQuantity });
      showCheckout();
    } catch (error) {
      showActionError(card, error.message);
    } finally {
      button.disabled = soldOut;
    }
  });
  return card;
}

function showCheckout() {
  checkout.hidden = false;
  bookingSummary.replaceChildren(
    el('p', { textContent: `${currentBooking.eventTitle} - ${currentBooking.tierName}` }),
    el('p', { textContent: `${currentBooking.quantity} ticket${currentBooking.quantity === 1 ? '' : 's'} - ${formatPrice(currentBooking.totalCents)}` }),
  );
  paymentError.hidden = true;
  checkout.scrollIntoView({ behavior: 'smooth', block: 'start' });
  startCountdown();
}

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  const update = () => {
    const remainingMs = new Date(currentBooking.holdExpiresAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      holdStatus.textContent = 'Seat hold expired';
      holdStatus.className = 'hold-status expired';
      clearInterval(countdownTimer);
      return;
    }
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    holdStatus.textContent = `Seats held for ${minutes}:${String(seconds).padStart(2, '0')}`;
    holdStatus.className = 'hold-status';
  };
  update();
  countdownTimer = setInterval(update, 1000);
}

async function initialise() {
  const eventId = new URLSearchParams(window.location.search).get('id');
  if (!eventId) {
    eventDetails.appendChild(el('p', { className: 'error', textContent: 'No event was specified.' }));
    return;
  }
  try {
    const event = await getEvent(eventId);
    document.title = event.title;
    eventDetails.replaceChildren(
      el('section', { className: 'event-heading' }, [
        el('p', { className: 'eyebrow', textContent: event.city }),
        el('h1', { textContent: event.title }),
        el('p', { className: 'event-meta', textContent: event.venue }),
        el('p', { className: 'event-meta', textContent: formatDate(event.startsAt) }),
      ]),
      el('section', { className: 'tier-section' }, [
        el('h2', { textContent: 'Choose tickets' }),
        el('div', { className: 'tier-list' }, event.tiers.map(tierCard)),
      ]),
    );
  } catch (error) {
    eventDetails.appendChild(el('p', { className: 'error', textContent: error.message }));
  }
}

paymentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentBooking || !paymentForm.reportValidity()) return;
  const submitButton = paymentForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Processing...';
  paymentError.hidden = true;
  const cardNumber = paymentForm.elements.cardNumber.value.replace(/\s/g, '');
  const decline = cardNumber.endsWith('0002');

  try {
    const result = await pay(currentBooking.reference, { decline });
    holdStatus.textContent = `Payment confirmed - booking ${result.reference}`;
    holdStatus.className = 'hold-status confirmed';
    clearInterval(countdownTimer);
    paymentForm.hidden = true;
  } catch (error) {
    paymentError.textContent = `${error.message} You can try again.`;
    paymentError.hidden = false;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Pay now';
  }
});

initialise();
