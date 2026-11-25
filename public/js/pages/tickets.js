import { cancelBooking, listBookings } from '../api.js';
import { clearSession, getSessionUser } from '../session.js';

const status = document.querySelector('#tickets-status');
const container = document.querySelector('#tickets');
const logout = document.querySelector('#logout');
const user = getSessionUser();

if (!user) window.location.href = '/login.html';

logout.addEventListener('click', () => {
  clearSession();
  window.location.href = '/login.html';
});

function bookingCard(booking) {
  const card = document.createElement('article');
  card.className = 'ticket-card';
  card.innerHTML = `
    <div><strong>${booking.reference}</strong><p>${booking.status}</p></div>
    <div><span>${booking.quantity} ticket(s)</span><span>${booking.amountCents / 100}</span></div>
  `;
  if (booking.status === 'pending') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button';
    button.textContent = 'Cancel';
    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = 'Cancelling...';
      try {
        await cancelBooking(booking.reference);
        await render();
      } catch (error) {
        status.textContent = error.message;
      }
    });
    card.appendChild(button);
  }
  return card;
}

async function render() {
  status.textContent = 'Loading tickets...';
  container.replaceChildren();
  try {
    const bookings = await listBookings();
    status.textContent = bookings.length ? '' : 'You have no bookings.';
    bookings.forEach((booking) => container.appendChild(bookingCard(booking)));
  } catch (error) {
    status.textContent = error.message;
  }
}

if (user) render();
