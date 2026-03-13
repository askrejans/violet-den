const request = require('supertest');
const app = require('../index');

describe('/api/setup-status', () => {
  it('returns setup_complete false if no admin creds', async () => {
    // Simulate no admin creds
    process.env.ADMIN_USERNAME = '';
    process.env.ADMIN_PASSWORD = '';
    const res = await request(app).get('/api/setup-status');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('setup_complete');
  });
});
