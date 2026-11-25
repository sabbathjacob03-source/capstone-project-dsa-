const TOKEN_KEY = 'event-ticketing-token';
const USER_KEY = 'event-ticketing-user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function setSession(session) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
