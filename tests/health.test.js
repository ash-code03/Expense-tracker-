const request = require('supertest');

// Mock database module
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  pool: { end: jest.fn() },
}));

const db = require('../src/config/database');
const app = require('../src/app');

describe('Health Check API (/api/health)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/health returns 200 UP when database is reachable', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ alive: 1 }] });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'UP');
    expect(response.body).toHaveProperty('database', 'connected');
    expect(response.body).toHaveProperty('timestamp');
  });

  test('GET /api/health returns 503 DEGRADED when database query fails', async () => {
    db.query.mockRejectedValueOnce(new Error('Connection timeout'));

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty('status', 'DEGRADED');
    expect(response.body).toHaveProperty('database', 'error');
  });
});
