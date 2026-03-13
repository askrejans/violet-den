const request = require('supertest');
const app = require('../index');
const { setConfig, getConfig } = require('../db');

// Helper to get a valid auth token
async function getAuthToken() {
  setConfig('admin_username', 'testuser');
  setConfig('admin_password', 'testpass');
  const res = await request(app)
    .post('/api/login')
    .send({ username: 'testuser', password: 'testpass' });
  return res.body.token;
}

describe('/api/sections', () => {
  beforeEach(() => {
    setConfig('sections', '[]');
  });

  it('GET returns empty array by default', async () => {
    const res = await request(app).get('/api/sections');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET returns saved sections (public, no auth needed)', async () => {
    const sections = [{ title: 'Servers', icon: 'dns', links: [{ name: 'Router', url: 'http://192.168.1.1' }] }];
    setConfig('sections', JSON.stringify(sections));
    const res = await request(app).get('/api/sections');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Servers');
  });

  it('GET returns empty array on invalid JSON in config', async () => {
    setConfig('sections', 'not-json');
    const res = await request(app).get('/api/sections');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('/api/save-sections', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/save-sections')
      .send({ config: '[]' });
    expect(res.statusCode).toBe(401);
  });

  it('saves sections with valid auth', async () => {
    const token = await getAuthToken();
    const sections = [{ title: 'New Section', icon: 'home', links: [] }];
    const res = await request(app)
      .post('/api/save-sections')
      .set('Authorization', `Bearer ${token}`)
      .send({ config: JSON.stringify(sections) });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const saved = JSON.parse(getConfig('sections', '[]'));
    expect(saved[0].title).toBe('New Section');
  });
});
