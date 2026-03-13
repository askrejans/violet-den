const request = require('supertest');
const app = require('../index');
const { db, setConfig } = require('../db');

async function getAuthToken() {
  setConfig('admin_username', 'testuser');
  setConfig('admin_password', 'testpass');
  const res = await request(app)
    .post('/api/login')
    .send({ username: 'testuser', password: 'testpass' });
  return res.body.token;
}

describe('Saved Commands CRUD', () => {
  let token;
  let serviceId;

  beforeAll(async () => {
    token = await getAuthToken();
  });

  beforeEach(async () => {
    db.prepare('DELETE FROM saved_commands').run();
    db.prepare('DELETE FROM ssh_services').run();

    const res = await request(app)
      .post('/api/ssh-services')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CmdTestServer', host: '10.0.0.1' });
    serviceId = res.body.id;
  });

  describe('POST /api/ssh-services/:id/commands', () => {
    it('creates a saved command', async () => {
      const res = await request(app)
        .post(`/api/ssh-services/${serviceId}/commands`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'List files', command: 'ls -la' });
      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('List files');
      expect(res.body.command).toBe('ls -la');
      expect(res.body.service_id).toBe(serviceId);
    });

    it('rejects without name or command', async () => {
      const res = await request(app)
        .post(`/api/ssh-services/${serviceId}/commands`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Only name' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/ssh-services/:id/commands', () => {
    it('returns commands for a service', async () => {
      await request(app)
        .post(`/api/ssh-services/${serviceId}/commands`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'cmd1', command: 'echo 1' });
      await request(app)
        .post(`/api/ssh-services/${serviceId}/commands`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'cmd2', command: 'echo 2' });

      const res = await request(app)
        .get(`/api/ssh-services/${serviceId}/commands`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('returns empty array for service with no commands', async () => {
      const res = await request(app)
        .get(`/api/ssh-services/${serviceId}/commands`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('PUT /api/commands/:id', () => {
    it('updates a command', async () => {
      const createRes = await request(app)
        .post(`/api/ssh-services/${serviceId}/commands`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'old', command: 'old-cmd' });
      const cmdId = createRes.body.id;

      const res = await request(app)
        .put(`/api/commands/${cmdId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'updated', command: 'new-cmd' });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects without name or command', async () => {
      const res = await request(app)
        .put('/api/commands/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'only-name' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/commands/:id', () => {
    it('deletes a command', async () => {
      const createRes = await request(app)
        .post(`/api/ssh-services/${serviceId}/commands`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'todelete', command: 'rm -rf' });
      const cmdId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/commands/${cmdId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const remaining = db.prepare('SELECT * FROM saved_commands WHERE id = ?').all(cmdId);
      expect(remaining).toHaveLength(0);
    });
  });
});
