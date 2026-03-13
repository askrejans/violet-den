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

describe('SSH Services CRUD', () => {
  let token;

  beforeEach(async () => {
    db.prepare('DELETE FROM saved_commands').run();
    db.prepare('DELETE FROM ssh_services').run();
    token = await getAuthToken();
  });

  describe('POST /api/ssh-services', () => {
    it('creates a new SSH service', async () => {
      const res = await request(app)
        .post('/api/ssh-services')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Server', host: '192.168.1.1', port: 22, username: 'root', password: 'secret', protocol: 'ssh' });
      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('Test Server');
      expect(res.body.host).toBe('192.168.1.1');
      expect(res.body.id).toBeDefined();
    });

    it('requires name and host', async () => {
      const res = await request(app)
        .post('/api/ssh-services')
        .set('Authorization', `Bearer ${token}`)
        .send({ port: 22 });
      expect(res.statusCode).toBe(400);
    });

    it('defaults port to 22 and protocol to ssh', async () => {
      const res = await request(app)
        .post('/api/ssh-services')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Minimal', host: '10.0.0.1' });
      expect(res.statusCode).toBe(200);
      expect(res.body.port).toBe(22);
      expect(res.body.protocol).toBe('ssh');
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/ssh-services')
        .send({ name: 'Test', host: '10.0.0.1' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/ssh-services', () => {
    it('returns all services with masked passwords', async () => {
      await request(app)
        .post('/api/ssh-services')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Server1', host: '10.0.0.1', password: 'secret' });

      const res = await request(app)
        .get('/api/ssh-services')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].password).toBe('••••••');
      expect(res.body[0].name).toBe('Server1');
    });
  });

  describe('PUT /api/ssh-services/:id', () => {
    it('updates a service', async () => {
      const createRes = await request(app)
        .post('/api/ssh-services')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Old Name', host: '10.0.0.1' });
      const id = createRes.body.id;

      const res = await request(app)
        .put(`/api/ssh-services/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name', host: '10.0.0.2', password: 'newpass' });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('preserves password when masked value sent', async () => {
      const createRes = await request(app)
        .post('/api/ssh-services')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Server', host: '10.0.0.1', password: 'original' });
      const id = createRes.body.id;

      await request(app)
        .put(`/api/ssh-services/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Server', host: '10.0.0.1', password: '••••••' });

      // Verify password was preserved by checking DB directly
      const row = db.prepare('SELECT password FROM ssh_services WHERE id = ?').get(id);
      expect(row.password).not.toBe('••••••');
      expect(row.password).toContain(':'); // encrypted format
    });

    it('rejects without name and host', async () => {
      const res = await request(app)
        .put('/api/ssh-services/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ port: 22 });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/ssh-services/:id', () => {
    it('deletes a service and its commands', async () => {
      const createRes = await request(app)
        .post('/api/ssh-services')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'ToDelete', host: '10.0.0.1' });
      const id = createRes.body.id;

      // Add a command
      await request(app)
        .post(`/api/ssh-services/${id}/commands`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'ls', command: 'ls -la' });

      const res = await request(app)
        .delete(`/api/ssh-services/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify commands also deleted
      const cmds = db.prepare('SELECT * FROM saved_commands WHERE service_id = ?').all(id);
      expect(cmds).toHaveLength(0);
    });
  });
});
