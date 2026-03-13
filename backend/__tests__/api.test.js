const request = require('supertest');
const express = require('express');
const app = require('../index');

describe('API', () => {
  it('GET / should return status and version', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('Backend running');
    expect(res.body).toHaveProperty('version');
  });
});
