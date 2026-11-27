import {
  acceptWaitlistOffer,
  cancelBooking,
  listBookings,
  listWaitlistOffers,
  previewRefund,
} from '../api.js';
import { clearSession, getSessionUser } from '../session.js';
import { el, formatPrice } from '../ui.js';
import { toCanvas } from '../qr.js';

const status = document.querySelector('#tickets-status');
const container = document.querySelector('#tickets');
const offersContainer = document.querySelector('#waitlist-offers');
const logout = document.querySelector('#logout');
const user = getSessionUser();
let countdownTimers = [];

if (!user) window.location.href = '/login.html';

logout.addEventListener('click', () => {
  clearSession();
  window.location.href = '/login.html';
});

function bookingCard(booking) {
  const card = el('article', { className: 'ticket-card' }, [
    el('div', {}, [
      el('strong', { textContent: booking.reference }),
      el('p', { textContent: booking.status }),
    ]),
    el('div', {}, [
      el('span', { textContent: `${booking.quantity} ticket(s)` }),
      el('span', { textContent: formatPrice(booking.amountCents) }),
    ]),
  ]);
  if (booking.status === 'paid') {
    const qrCode = el('canvas', { className: 'ticket-qr' });
    qrCode.setAttribute('role', 'img');
    qrCode.setAttribute('aria-label', `QR code for ticket ${booking.reference}`);
    toCanvas(qrCode, booking.ticketToken);
    card.appendChild(qrCode);
  }
  if (booking.status === 'pending' || booking.status === 'paid') {
    const button = el('button', {
      type: 'button',
      className: 'secondary-button',
      textContent: booking.status === 'paid' ? 'Cancel and refund' : 'Cancel booking',
    });
    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = 'Checking refund...';
      try {
        const preview = await previewRefund(booking.reference);
        const refundText = preview.refundAmountCents === 0
          ? 'No refund will be issued.'
          : `Refund: ${formatPrice(preview.refundAmountCents)}.`;
        if (!window.confirm(`${refundText} Cancel this booking?`)) {
          status.textContent = '';
          button.disabled = false;
          return;
        }
        status.textContent = 'Cancelling...';
        await cancelBooking(booking.reference);
        await render();
      } catch (error) {
        status.textContent = error.message;
        button.disabled = false;
      }
    });
    card.appendChild(button);
  }
  return card;
}

function offerCard(offer) {
  const countdown = el('p', { className: 'offer-countdown', role: 'status' });
  let refreshed = false;
  const button = el('button', {
    type: 'button',
    className: 'primary-button',
    textContent: 'Accept offer',
  });
  const card = el('article', { className: 'ticket-card' }, [
    el('div', {}, [
      el('strong', { textContent: `${offer.eventTitle} - ${offer.tierName}` }),
      countdown,
    ]),
    button,
  ]);
  const updateCountdown = () => {
    const remaining = Date.parse(offer.offerExpiresAt) - Date.now();
    if (remaining <= 0) {
      countdown.textContent = 'Offer expired';
      button.disabled = true;
      if (!refreshed) {
        refreshed = true;
        countdownTimers.push(setTimeout(() => render(), 1500));
      }
      return;
    }
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    countdown.textContent = `Offer expires in ${minutes}:${String(seconds).padStart(2, '0')}`;
  };
  updateCountdown();
  countdownTimers.push(setInterval(updateCountdown, 1000));
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Accepting offer...';
    try {
      const booking = await acceptWaitlistOffer(offer.id);
      status.textContent = `Offer accepted. Booking reference: ${booking.reference}`;
      await render();
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  });
  return card;
}

async function render() {
  countdownTimers.forEach(clearInterval);
  countdownTimers = [];
  status.textContent = 'Loading tickets...';
  container.replaceChildren();
  offersContainer.replaceChildren();
  try {
    const [bookings, offers] = await Promise.all([listBookings(), listWaitlistOffers()]);
    status.textContent = bookings.length ? '' : 'You have no bookings.';
    bookings.forEach((booking) => container.appendChild(bookingCard(booking)));
    if (!offers.length) {
      offersContainer.appendChild(el('p', { className: 'empty-state', textContent: 'You have no active waitlist offers.' }));
    } else {
      offers.forEach((offer) => offersContainer.appendChild(offerCard(offer)));
    }
  } catch (error) {
    status.textContent = error.message;
  }
}

if (user) render();
