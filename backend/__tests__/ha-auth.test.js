const request = require('supertest');
const { db } = require('../db');

// HA integration env vars must be set BEFORE requiring the app.
// With maxWorkers: 1, tests run sequentially in one process, so we save/restore env.
const originalHaIntegration = process.env.HA_INTEGRATION;
const originalHaUrl = process.env.HA_URL;

function cleanDb() {
  db.prepare("DELETE FROM config WHERE key IN ('admin_username', 'admin_password')").run();
}

describe('HA Auth API — disabled', () => {
  let app;

  beforeAll(() => {
    delete process.env.HA_INTEGRATION;
    delete process.env.HA_URL;
    jest.resetModules();
    app = require('../index');
  });

  afterAll(() => {
    process.env.HA_INTEGRATION = originalHaIntegration;
    process.env.HA_URL = originalHaUrl;
    cleanDb();
  });

  it('returns 404 when HA_INTEGRATION is not enabled', async () => {
    const res = await request(app)
      .post('/api/ha-auth')
      .send({ ha_token: 'some-token' });
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/not enabled/i);
  });
});

describe('HA Auth API — enabled', () => {
  let app;

  beforeAll(() => {
    process.env.HA_INTEGRATION = 'true';
    process.env.HA_URL = 'http://fake-ha:8123';
    jest.resetModules();
    app = require('../index');
  });

  afterAll(() => {
    process.env.HA_INTEGRATION = originalHaIntegration;
    process.env.HA_URL = originalHaUrl;
    cleanDb();
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    cleanDb();
  });

  it('rejects request without ha_token', async () => {
    const res = await request(app)
      .post('/api/ha-auth')
      .send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/ha_token required/i);
  });

  it('rejects invalid HA token (HA API returns 401)', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 401 })
    );

    const res = await request(app)
      .post('/api/ha-auth')
      .send({ ha_token: 'invalid-token' });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalid home assistant token/i);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://fake-ha:8123/api/',
      expect.objectContaining({
        headers: { Authorization: 'Bearer invalid-token' },
      })
    );
  });

  it('returns VioletDen session token for valid HA token', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200 })
    );

    const res = await request(app)
      .post('/api/ha-auth')
      .send({ ha_token: 'valid-ha-token' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.token.length).toBe(64);
  });

  it('auto-completes setup on first HA auth', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200 })
    );

    const res = await request(app)
      .post('/api/ha-auth')
      .send({ ha_token: 'valid-ha-token' });
    expect(res.statusCode).toBe(200);

    const statusRes = await request(app).get('/api/setup-status');
    expect(statusRes.body.setup_complete).toBe(true);
  });

  it('returned token works for authenticated endpoints', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200 })
    );

    const haRes = await request(app)
      .post('/api/ha-auth')
      .send({ ha_token: 'valid-ha-token' });

    const sshRes = await request(app)
      .get('/api/ssh-services')
      .set('Authorization', `Bearer ${haRes.body.token}`);
    expect(sshRes.statusCode).toBe(200);
  });

  it('handles HA API unreachable (network error)', async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('ECONNREFUSED'))
    );

    const res = await request(app)
      .post('/api/ha-auth')
      .send({ ha_token: 'some-token' });
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toMatch(/cannot reach home assistant/i);
  });
});

describe('/api/setup-status with HA mode', () => {
  let app;

  beforeAll(() => {
    process.env.HA_INTEGRATION = 'true';
    process.env.HA_URL = 'http://fake-ha:8123';
    jest.resetModules();
    app = require('../index');
  });

  afterAll(() => {
    process.env.HA_INTEGRATION = originalHaIntegration;
    process.env.HA_URL = originalHaUrl;
    cleanDb();
  });

  it('includes ha_mode: true in setup-status response', async () => {
    const res = await request(app).get('/api/setup-status');
    expect(res.statusCode).toBe(200);
    expect(res.body.ha_mode).toBe(true);
  });
});
