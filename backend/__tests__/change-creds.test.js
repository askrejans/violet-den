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

describe('/api/change-creds', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/change-creds')
      .send({ username: 'new', password: 'new' });
    expect(res.statusCode).toBe(401);
  });

  it('updates credentials with valid auth', async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .post('/api/change-creds')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'newadmin', password: 'newpass' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getConfig('admin_username')).toBe('newadmin');
    expect(getConfig('admin_password')).toBe('newpass');
  });

  it('rejects when username is missing', async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .post('/api/change-creds')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'onlypass' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects when password is missing', async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .post('/api/change-creds')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'onlyuser' });
    expect(res.statusCode).toBe(400);
  });
});
