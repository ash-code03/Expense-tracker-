const request = require('supertest');

// Mock database module for isolated safe testing
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  pool: { end: jest.fn() },
}));

const db = require('../src/config/database');
const app = require('../src/app');

describe('Expense Management Endpoints (/api/expenses)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/expenses', () => {
    test('creates a new expense successfully with valid data', async () => {
      const newExpense = {
        title: 'Books and Notebooks',
        amount: 850.5,
        category: 'Education',
        expense_date: '2026-10-13',
        payment_method: 'UPI',
        description: 'Semester textbooks',
      };

      const mockDbRow = {
        id: 1,
        ...newExpense,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      db.query.mockResolvedValueOnce({ rows: [mockDbRow] });

      const res = await request(app)
        .post('/api/expenses')
        .send(newExpense);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Books and Notebooks');
      expect(res.body.data.amount).toBe(850.5);
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('rejects negative or zero amount with 400 Bad Request', async () => {
      const invalidExpense = {
        title: 'Snacks',
        amount: -50,
        category: 'Food',
        expense_date: '2026-10-13',
      };

      const res = await request(app)
        .post('/api/expenses')
        .send(invalidExpense);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('Expense amount must be greater than zero.');
      expect(db.query).not.toHaveBeenCalled();
    });

    test('rejects missing or empty title with 400 Bad Request', async () => {
      const invalidExpense = {
        title: '   ',
        amount: 120,
        category: 'Food',
        expense_date: '2026-10-13',
      };

      const res = await request(app)
        .post('/api/expenses')
        .send(invalidExpense);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0]).toMatch(/title is required/i);
      expect(db.query).not.toHaveBeenCalled();
    });

    test('rejects unallowed category with 400 Bad Request', async () => {
      const invalidExpense = {
        title: 'Crypto Gambling',
        amount: 500,
        category: 'Speculation', // not in allowed categories
        expense_date: '2026-10-13',
      };

      const res = await request(app)
        .post('/api/expenses')
        .send(invalidExpense);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0]).toMatch(/category is required/i);
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/expenses', () => {
    test('retrieves paginated list of expenses', async () => {
      const mockExpenses = [
        { id: 1, title: 'Lunch', amount: 200, category: 'Food', expense_date: '2026-10-12' },
        { id: 2, title: 'Bus pass', amount: 500, category: 'Transportation', expense_date: '2026-10-11' },
      ];

      // First query: count
      db.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      // Second query: select rows
      db.query.mockResolvedValueOnce({ rows: mockExpenses });

      const res = await request(app).get('/api/expenses?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.page).toBe(1);
    });
  });

  describe('GET /api/expenses/:id', () => {
    test('retrieves expense by ID when found', async () => {
      const mockExpense = { id: 1, title: 'Coffee', amount: 150, category: 'Food', expense_date: '2026-10-13' };
      db.query.mockResolvedValueOnce({ rows: [mockExpense] });

      const res = await request(app).get('/api/expenses/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(1);
    });

    test('returns 404 when expense is not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/expenses/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test('returns 400 for invalid ID parameter format', async () => {
      const res = await request(app).get('/api/expenses/not-a-number');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid expense ID/i);
    });
  });

  describe('PUT /api/expenses/:id', () => {
    test('updates expense successfully', async () => {
      const updatedExpense = {
        title: 'Team Dinner',
        amount: 1450,
        category: 'Food',
        expense_date: '2026-10-13',
        payment_method: 'UPI',
        description: 'Dinner with colleagues',
      };

      db.query.mockResolvedValueOnce({ rows: [{ id: 1, ...updatedExpense }] });

      const res = await request(app)
        .put('/api/expenses/1')
        .send(updatedExpense);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Team Dinner');
    });

    test('rejects update with negative amount', async () => {
      const res = await request(app)
        .put('/api/expenses/1')
        .send({
          title: 'Team Dinner',
          amount: -10,
          category: 'Food',
          expense_date: '2026-10-13',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/expenses/:id', () => {
    test('deletes expense when found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, title: 'Old Bill' }] });

      const res = await request(app).delete('/api/expenses/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted successfully/i);
    });

    test('returns 404 when deleting non-existent expense', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/expenses/9999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/summary', () => {
    test('returns calculated summary statistics', async () => {
      // 1. Overall total and count
      db.query.mockResolvedValueOnce({
        rows: [{ total_expenses: '5200.50', total_transactions: '12' }],
      });
      // 2. This month
      db.query.mockResolvedValueOnce({
        rows: [{ this_month: '1850.00' }],
      });
      // 3. Highest category
      db.query.mockResolvedValueOnce({
        rows: [{ category: 'Food', total: '2100.00' }],
      });

      const res = await request(app).get('/api/summary');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalExpenses).toBe(5200.5);
      expect(res.body.data.thisMonthExpenses).toBe(1850);
      expect(res.body.data.totalTransactions).toBe(12);
      expect(res.body.data.highestCategory.name).toBe('Food');
    });

    test('handles empty database gracefully with zeroes', async () => {
      // 1. Overall
      db.query.mockResolvedValueOnce({
        rows: [{ total_expenses: null, total_transactions: '0' }],
      });
      // 2. Month
      db.query.mockResolvedValueOnce({
        rows: [{ this_month: null }],
      });
      // 3. Highest category
      db.query.mockResolvedValueOnce({
        rows: [],
      });

      const res = await request(app).get('/api/summary');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalExpenses).toBe(0);
      expect(res.body.data.thisMonthExpenses).toBe(0);
      expect(res.body.data.totalTransactions).toBe(0);
      expect(res.body.data.highestCategory.name).toBe('None');
    });
  });
});
