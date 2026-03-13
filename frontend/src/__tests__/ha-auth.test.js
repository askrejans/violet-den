import { api, setToken, getToken, haAuth, setHaMode, isHaMode } from '../api';

// Mock sessionStorage
const storage = {};
beforeAll(() => {
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: (key) => storage[key] || null,
      setItem: (key, val) => { storage[key] = val; },
      removeItem: (key) => { delete storage[key]; },
    },
    writable: true,
  });
});

beforeEach(() => {
  setToken(null);
  setHaMode(false);
  jest.restoreAllMocks();
});

describe('HA mode helpers', () => {
  it('isHaMode defaults to false', () => {
    expect(isHaMode()).toBe(false);
  });

  it('setHaMode enables HA mode', () => {
    setHaMode(true);
    expect(isHaMode()).toBe(true);
  });

  it('setHaMode can disable HA mode', () => {
    setHaMode(true);
    setHaMode(false);
    expect(isHaMode()).toBe(false);
  });
});

describe('haAuth', () => {
  it('returns true and sets token on successful HA auth', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, token: 'vd-session-token' }),
      })
    );

    const result = await haAuth('valid-ha-token');

    expect(result).toBe(true);
    expect(getToken()).toBe('vd-session-token');

    // Verify correct endpoint called
    expect(global.fetch).toHaveBeenCalledWith('/api/ha-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ha_token: 'valid-ha-token' }),
    });
  });

  it('returns false on failed HA auth (401)', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Invalid token' }),
      })
    );

    const result = await haAuth('invalid-token');

    expect(result).toBe(false);
    expect(getToken()).toBeNull();
  });

  it('returns false on network error', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

    const result = await haAuth('any-token');

    expect(result).toBe(false);
    expect(getToken()).toBeNull();
  });

  it('returns false when response has success: false', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: false }),
      })
    );

    const result = await haAuth('some-token');

    expect(result).toBe(false);
  });
});

describe('api() in HA mode', () => {
  it('does not reload on 401 for ha-auth endpoint', async () => {
    setToken('old-token');
    // In non-HA mode, 401 on a regular endpoint would reload.
    // For ha-auth URL, it should NOT reload.
    // We verify by checking token is NOT cleared (ha-auth is excluded).
    global.fetch = jest.fn(() =>
      Promise.resolve({ status: 401 })
    );

    await api('/api/ha-auth', { method: 'POST', body: '{}' });

    // Token should still be set (401 handler skips ha-auth URLs)
    expect(getToken()).toBe('old-token');
  });

  it('sends postMessage to parent in HA mode on 401', async () => {
    setToken('expired-token');
    setHaMode(true);

    const postMessageMock = jest.fn();
    const originalParent = window.parent;
    Object.defineProperty(window, 'parent', {
      value: { postMessage: postMessageMock },
      writable: true,
    });

    global.fetch = jest.fn(() =>
      Promise.resolve({ status: 401 })
    );

    await api('/api/some-endpoint');

    expect(postMessageMock).toHaveBeenCalledWith(
      { type: 'violetden-ready' },
      '*'
    );

    Object.defineProperty(window, 'parent', { value: originalParent, writable: true });
  });
});
