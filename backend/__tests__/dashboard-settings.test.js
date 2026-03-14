const request = require('supertest');
const app = require('../index');
const { setConfig, getConfig } = require('../db');

async function getAuthToken() {
  setConfig('admin_username', 'testuser');
  setConfig('admin_password', 'testpass');
  const res = await request(app)
    .post('/api/login')
    .send({ username: 'testuser', password: 'testpass' });
  return res.body.token;
}

describe('/api/dashboard-settings', () => {
  beforeEach(() => {
    // Reset to default
    setConfig('show_urls', 'true');
  });

  it('GET returns default show_urls=true', async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .get('/api/dashboard-settings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.show_urls).toBe(true);
  });

  it('GET rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/dashboard-settings');
    expect(res.statusCode).toBe(401);
  });

  it('POST updates show_urls to false', async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .post('/api/dashboard-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ show_urls: false });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getConfig('show_urls', 'true')).toBe('false');
  });

  it('POST updates show_urls to true', async () => {
    setConfig('show_urls', 'false');
    const token = await getAuthToken();
    const res = await request(app)
      .post('/api/dashboard-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ show_urls: true });
    expect(res.statusCode).toBe(200);
    expect(getConfig('show_urls', 'true')).toBe('true');
  });

  it('POST rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/dashboard-settings')
      .send({ show_urls: false });
    expect(res.statusCode).toBe(401);
  });
});
