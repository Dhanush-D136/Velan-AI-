import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';

describe('Server Health and API Endpoints', () => {
  it('GET /health returns healthy status for Render monitoring', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.system).toBe('Velan AI College Platform');
  });

  it('POST /api/auth/login validates credentials correctly with username Vel', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'Vel',
        password: process.env.ADMIN_PASSWORD || 'elite minds',
        deviceId: 'dev_test_runner',
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.token).toBeDefined();
  });

  it('POST /api/auth/login rejects invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'Vel',
        password: 'WrongPassword@999',
        deviceId: 'dev_test_runner',
      });

    expect(res.status).toBe(401);
  });
});
