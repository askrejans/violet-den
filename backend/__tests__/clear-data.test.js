const request = require('supertest');
const app = require('../index');
const { db, setConfig, getConfig } = require('../db');

async function getAuthToken() {
  setConfig('admin_username', 'testuser');
  setConfig('admin_password', 'testpass');
  const res = await request(app)
    .post('/api/login')
    .send({ username: 'testuser', password: 'testpass' });
  return res.body.token;
}

describe('/api/clear-data', () => {
  let token;

  beforeAll(async () => {
    token = await getAuthToken();
  });

  beforeEach(() => {
    // Set up test data
    setConfig('sections', JSON.stringify([{ title: 'Test', links: [] }]));
    setConfig('admin_username', 'testuser');
    setConfig('admin_password', 'testpass');
    db.prepare('DELETE FROM saved_commands').run();
    db.prepare('DELETE FROM ssh_services').run();
    db.prepare("INSERT INTO ssh_services (name, host, port, username, password, protocol) VALUES (?, ?, ?, ?, ?, ?)")
      .run('TestSrv', '10.0.0.1', 22, 'root', 'enc', 'ssh');
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/clear-data')
      .send({ target: 'sections' });
    expect(res.statusCode).toBe(401);
  });

  it('clears sections only', async () => {
    const res = await request(app)
      .post('/api/clear-data')
      .set('Authorization', `Bearer ${token}`)
      .send({ target: 'sections' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getConfig('sections')).toBe('[]');
    // SSH services should still exist
    const svc = db.prepare('SELECT * FROM ssh_services').all();
    expect(svc.length).toBeGreaterThan(0);
  });

  it('clears ssh_services and their commands', async () => {
    const res = await request(app)
      .post('/api/clear-data')
      .set('Authorization', `Bearer ${token}`)
      .send({ target: 'ssh_services' });
    expect(res.statusCode).toBe(200);
    const svc = db.prepare('SELECT * FROM ssh_services').all();
    expect(svc).toHaveLength(0);
  });

  it('clears credentials', async () => {
    const res = await request(app)
      .post('/api/clear-data')
      .set('Authorization', `Bearer ${token}`)
      .send({ target: 'credentials' });
    expect(res.statusCode).toBe(200);
    expect(getConfig('admin_username', null)).toBeNull();
    expect(getConfig('admin_password', null)).toBeNull();
  });

  it('clears all data', async () => {
    const res = await request(app)
      .post('/api/clear-data')
      .set('Authorization', `Bearer ${token}`)
      .send({ target: 'all' });
    expect(res.statusCode).toBe(200);
    expect(getConfig('sections', null)).toBeNull();
    expect(getConfig('admin_username', null)).toBeNull();
    const svc = db.prepare('SELECT * FROM ssh_services').all();
    expect(svc).toHaveLength(0);
  });
});
