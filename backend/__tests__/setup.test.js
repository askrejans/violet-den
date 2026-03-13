const request = require('supertest');
const app = require('../index');
const { db, getConfig } = require('../db');

describe('/api/setup', () => {
  beforeEach(() => {
    // Clear admin credentials so setup is available
    db.prepare("DELETE FROM config WHERE key IN ('admin_username', 'admin_password')").run();
  });

  it('should complete setup with valid username and password', async () => {
    const res = await request(app)
      .post('/api/setup')
      .send({ username: 'newadmin', password: 'newpass123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getConfig('admin_username')).toBe('newadmin');
    expect(getConfig('admin_password')).toBe('newpass123');
  });

  it('should save sections when provided', async () => {
    const sections = [{ title: 'Test', icon: 'home', links: [] }];
    const res = await request(app)
      .post('/api/setup')
      .send({ username: 'admin', password: 'pass1234', sections });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const saved = JSON.parse(getConfig('sections', '[]'));
    expect(saved).toHaveLength(1);
    expect(saved[0].title).toBe('Test');
  });

  it('should reject if username missing', async () => {
    const res = await request(app)
      .post('/api/setup')
      .send({ password: 'pass1234' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject if password missing', async () => {
    const res = await request(app)
      .post('/api/setup')
      .send({ username: 'admin' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should block setup if already completed', async () => {
    // Complete setup first
    await request(app)
      .post('/api/setup')
      .send({ username: 'admin', password: 'pass1234' });

    // Try again
    const res = await request(app)
      .post('/api/setup')
      .send({ username: 'hacker', password: 'hacked' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/already completed/i);
  });
});
