import { createEvent, createTier, listMyEvents, publishEvent } from '../api.js';
import { clearSession, getSessionUser } from '../session.js';

const user = getSessionUser();
if (!user || user.role !== 'organizer') window.location.href = '/login.html';

document.querySelector('#logout').addEventListener('click', () => {
  clearSession();
  window.location.href = '/login.html';
});

const form = document.querySelector('#event-form');
const errorElement = document.querySelector('#event-error');
const status = document.querySelector('#organizer-status');
const container = document.querySelector('#organizer-events');

async function renderEvents() {
  status.textContent = 'Loading events...';
  container.replaceChildren();
  try {
    const ownEvents = await listMyEvents();
    status.textContent = ownEvents.length ? '' : 'No events yet.';
    ownEvents.forEach((event) => container.appendChild(eventCard(event)));
  } catch (error) {
    status.textContent = error.message;
  }
}

function eventCard(event) {
  const card = document.createElement('article');
  card.className = 'ticket-card';
  card.innerHTML = `
    <div><strong>${event.title}</strong><p>${event.city} - ${event.status}</p></div>
  `;
  const tierForm = document.createElement('form');
  tierForm.className = 'tier-form';
  tierForm.innerHTML = `
    <input name="name" placeholder="Tier name" required>
    <input name="priceCents" type="number" min="0" step="1" placeholder="Price cents" required>
    <input name="capacity" type="number" min="1" step="1" placeholder="Capacity" required>
    <button type="submit" class="secondary-button">Add tier</button>
  `;
  tierForm.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    try {
      await createTier(event.id, {
        name: tierForm.elements.name.value,
        priceCents: Number(tierForm.elements.priceCents.value),
        capacity: Number(tierForm.elements.capacity.value),
      });
      status.textContent = 'Tier added.';
      await renderEvents();
    } catch (error) {
      status.textContent = error.message;
    }
  });
  card.appendChild(tierForm);
  if (event.status === 'draft') {
    const publish = document.createElement('button');
    publish.type = 'button';
    publish.className = 'secondary-button';
    publish.textContent = 'Publish';
    publish.addEventListener('click', async () => {
      publish.disabled = true;
      try {
        await publishEvent(event.id);
        await renderEvents();
      } catch (error) {
        status.textContent = error.message;
      }
    });
    card.appendChild(publish);
  }
  return card;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  errorElement.hidden = true;
  try {
    await createEvent({
      title: form.elements.title.value,
      city: form.elements.city.value,
      venue: form.elements.venue.value,
      startsAt: new Date(form.elements.startsAt.value).toISOString(),
    });
    form.reset();
    await renderEvents();
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.hidden = false;
  }
});

if (user?.role === 'organizer') renderEvents();
