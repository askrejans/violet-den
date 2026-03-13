const request = require('supertest');
const app = require('../index');
const { db } = require('../db');

describe('/api/validate-token', () => {
  beforeEach(() => {
    db.prepare("DELETE FROM config WHERE key IN ('admin_username', 'admin_password')").run();
  });

  it('returns valid: false with no auth header', async () => {
    const res = await request(app).get('/api/validate-token');
    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it('returns valid: false with invalid token', async () => {
    const res = await request(app)
      .get('/api/validate-token')
      .set('Authorization', 'Bearer invalidtoken123');
    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it('returns valid: false with malformed auth header', async () => {
    const res = await request(app)
      .get('/api/validate-token')
      .set('Authorization', 'Basic abc123');
    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it('returns valid: true for a valid session token', async () => {
    // First set up credentials and login
    const { setConfig } = require('../db');
    setConfig('admin_username', 'tokentest');
    setConfig('admin_password', 'tokenpass');

    const loginRes = await request(app)
      .post('/api/login')
      .send({ username: 'tokentest', password: 'tokenpass' });
    expect(loginRes.body.success).toBe(true);

    const res = await request(app)
      .get('/api/validate-token')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(true);
  });
});
