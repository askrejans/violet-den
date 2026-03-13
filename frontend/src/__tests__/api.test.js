import { api, setToken, getToken } from '../api';

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
  jest.restoreAllMocks();
});

describe('api module exports', () => {
  it('exports api as a function', () => {
    expect(typeof api).toBe('function');
  });

  it('exports setToken as a function', () => {
    expect(typeof setToken).toBe('function');
  });

  it('exports getToken as a function', () => {
    expect(typeof getToken).toBe('function');
  });
});

describe('setToken / getToken', () => {
  it('stores and retrieves a token', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');
  });

  it('clears token when set to null', () => {
    setToken('abc123');
    setToken(null);
    expect(getToken()).toBeNull();
  });
});

describe('api()', () => {
  it('adds Authorization header when token is set', async () => {
    setToken('mytoken');
    global.fetch = jest.fn(() => Promise.resolve({ status: 200, json: () => Promise.resolve({}) }));

    await api('/api/test');

    expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer mytoken',
      }),
    }));
  });

  it('does not add Authorization header when no token', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ status: 200, json: () => Promise.resolve({}) }));

    await api('/api/test');

    const callHeaders = global.fetch.mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBeUndefined();
  });

  it('adds Content-Type for requests with body', async () => {
    setToken('tok');
    global.fetch = jest.fn(() => Promise.resolve({ status: 200, json: () => Promise.resolve({}) }));

    await api('/api/test', { body: JSON.stringify({ data: 1 }) });

    const callHeaders = global.fetch.mock.calls[0][1].headers;
    expect(callHeaders['Content-Type']).toBe('application/json');
  });

  it('returns the fetch response', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ status: 200, ok: true }));
    const res = await api('/api/test');
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
  });

  it('passes custom options through to fetch', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ status: 200 }));
    await api('/api/test', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ a: 1 }));
  });
});
