import { login, signup } from '../api.js';
import { setSession, getSessionUser } from '../session.js';

const form = document.querySelector('#auth-form');
const roleField = document.querySelector('#role-field');
const errorElement = document.querySelector('#auth-error');
const submitButton = document.querySelector('#auth-submit');
const title = document.querySelector('#auth-title');
const loginTab = document.querySelector('#login-tab');
const signupTab = document.querySelector('#signup-tab');
let mode = 'login';

function setMode(nextMode) {
  mode = nextMode;
  const signingUp = mode === 'signup';
  roleField.hidden = !signingUp;
  title.textContent = signingUp ? 'Sign up' : 'Log in';
  submitButton.textContent = signingUp ? 'Create account' : 'Log in';
  form.elements.password.autocomplete = signingUp ? 'new-password' : 'current-password';
  loginTab.classList.toggle('active', !signingUp);
  signupTab.classList.toggle('active', signingUp);
  errorElement.hidden = true;
}

loginTab.addEventListener('click', () => setMode('login'));
signupTab.addEventListener('click', () => setMode('signup'));

form.addEventListener('submit', async (event) => {
  event.preventEvent?.();
  event.preventDefault();
  if (!form.reportValidity()) return;
  submitButton.disabled = true;
  submitButton.textContent = mode === 'signup' ? 'Creating...' : 'Logging in...';
  errorElement.hidden = true;
  try {
    const input = {
      email: form.elements.email.value,
      password: form.elements.password.value,
    };
    if (mode === 'signup') input.role = form.elements.role.value;
    const session = mode === 'signup' ? await signup(input) : await login(input);
    setSession(session);
    window.location.href = session.user.role === 'organizer'
      ? '/organizer.html'
      : session.user.role === 'attendee'
        ? '/tickets.html'
        : '/index.html';
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.hidden = false;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = mode === 'signup' ? 'Create account' : 'Log in';
  }
});

const user = getSessionUser();
if (user) {
  window.location.href = user.role === 'organizer'
    ? '/organizer.html'
    : user.role === 'attendee'
      ? '/tickets.html'
      : '/index.html';
}
