import { checkInTicket } from '../api.js';
import { clearSession, getSessionUser } from '../session.js';

const user = getSessionUser();
const form = document.querySelector('#checkin-form');
const codeInput = document.querySelector('#ticket-code');
const submitButton = document.querySelector('#checkin-submit');
const result = document.querySelector('#checkin-result');
const logout = document.querySelector('#logout');

logout.addEventListener('click', () => {
  clearSession();
  window.location.href = '/login.html';
});

if (!user) {
  window.location.href = '/login.html';
} else if (user.role !== 'staff') {
  result.textContent = 'Only staff can check in tickets.';
  form.hidden = true;
} else {
  codeInput.focus();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!user || user.role !== 'staff' || !form.reportValidity()) return;
  submitButton.disabled = true;
  result.className = '';
  result.textContent = 'Checking ticket...';
  try {
    const admission = await checkInTicket(codeInput.value.trim());
    result.className = 'checkin-success';
    result.textContent = `Admitted ${admission.bookingReference} at ${new Date(admission.checkedInAt).toLocaleTimeString()}.`;
    codeInput.value = '';
    codeInput.focus();
  } catch (error) {
    result.className = 'error';
    result.textContent = error.code === 'DUPLICATE_SCAN' && error.checkedInAt
      ? `This ticket was already used at ${new Date(error.checkedInAt).toLocaleTimeString()}.`
      : error.message;
    codeInput.select();
  } finally {
    submitButton.disabled = false;
  }
});
