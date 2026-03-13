/* Thin wrapper around fetch that handles auth token automatically */

let _token = sessionStorage.getItem('vd_token') || null;
let _haMode = false;

export const setToken = (token) => {
  _token = token;
  if (token) sessionStorage.setItem('vd_token', token);
  else       sessionStorage.removeItem('vd_token');
};

export const getToken = () => _token;

export const setHaMode = (enabled) => { _haMode = enabled; };
export const isHaMode  = () => _haMode;

export const api = async (url, options = {}) => {
  const headers = { ...options.headers };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, { ...options, headers });

  // If 401, clear the stored token (session expired)
  // Skip auto-reload for validate-token and ha-auth (handled separately)
  if (res.status === 401 && _token && !url.includes('/api/validate-token') && !url.includes('/api/ha-auth')) {
    setToken(null);
    if (_haMode) {
      // In HA mode, request re-auth from parent panel instead of reloading
      window.parent.postMessage({ type: 'violetden-ready' }, '*');
    } else {
      window.location.reload();
    }
  }

  return res;
};

/**
 * Authenticate using a Home Assistant access token.
 * Sends the HA token to the backend, which validates it against the HA API.
 * Returns true if auth succeeded.
 */
export const haAuth = async (haToken) => {
  try {
    const res = await fetch('/api/ha-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ha_token: haToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.success && data.token) {
      setToken(data.token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};
