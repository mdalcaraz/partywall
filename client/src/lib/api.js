const TOKEN_KEY  = 'auth_token';
const DEVICE_KEY = 'pw_device_id';

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) { id = randomId(); localStorage.setItem(DEVICE_KEY, id); }
  return id;
}

export const getToken    = ()  => localStorage.getItem(TOKEN_KEY);
export const setToken    = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken  = ()  => localStorage.removeItem(TOKEN_KEY);

export function decodeToken(token = getToken()) {
  if (!token) return null;
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
}

export function authFetch(url, options = {}) {
  const token = getToken();
  return fetch(url, {
    ...options,
    headers: { ...options.headers, 'x-auth-token': token || '' },
  }).then((res) => {
    if (res.status === 401) {
      clearToken();
      window.location.href = '/partywall/login';
    }
    return res;
  });
}
