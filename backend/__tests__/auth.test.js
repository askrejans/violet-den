const request = require('supertest');
const app = require('../index');
const { setConfig } = require('../db');

describe('Auth API', () => {
  beforeEach(() => {
    setConfig('admin_username', 'admin');
    setConfig('admin_password', 'password123');
  });

  it('should reject login with wrong credentials', async () => {
    const res = await request(app).post('/api/login').send({ username: 'wrong', password: 'wrong' });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('should login successfully with correct credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'admin', password: 'password123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.token.length).toBe(64); // 32 bytes hex
  });

  it('should reject missing username or password', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'admin' });
    expect(res.statusCode).toBe(401);
  });
});

describe('requireAuth middleware', () => {
  it('rejects requests without Authorization header', async () => {
    const res = await request(app).get('/api/ssh-services');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('rejects requests with invalid token', async () => {
    const res = await request(app)
      .get('/api/ssh-services')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/session expired/i);
  });

  it('rejects requests with non-Bearer auth', async () => {
    const res = await request(app)
      .get('/api/ssh-services')
      .set('Authorization', 'Basic abc123');
    expect(res.statusCode).toBe(401);
  });

  it('allows requests with valid token', async () => {
    setConfig('admin_username', 'admin');
    setConfig('admin_password', 'pass');
    const loginRes = await request(app)
      .post('/api/login')
      .send({ username: 'admin', password: 'pass' });

    const res = await request(app)
      .get('/api/ssh-services')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(res.statusCode).toBe(200);
  });
});

describe('Rate limiting', () => {
  it('should rate limit after too many attempts', async () => {
    for (let i = 0; i < 11; i++) {
      await request(app)
        .post('/api/login')
        .set('X-Forwarded-For', '99.99.99.99')
        .send({ username: 'wrong', password: 'wrong' });
    }
    const res = await request(app)
      .post('/api/login')
      .set('X-Forwarded-For', '99.99.99.99')
      .send({ username: 'wrong', password: 'wrong' });
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toMatch(/too many/i);
  });
});
