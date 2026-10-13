const { Pool } = require('pg');
require('dotenv').config();

// Determine database configuration from environment variables
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'expensetrack',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    };

const pool = new Pool(poolConfig);

// Flag indicating whether real PostgreSQL connection is active
let isRealPostgres = false;

// In-memory fallback store for local evaluation when PostgreSQL is not installed/running on host
const localStore = {
  expenses: [],
  nextId: 1,
};

// Keep track of pool connection errors to avoid unhandled crash
pool.on('error', (err) => {
  console.error('[PostgreSQL] Client pool error:', err.message);
});

/**
 * Fallback query interpreter for local development without PostgreSQL
 */
const executeLocalQuery = (text, params = []) => {
  const normalized = text.trim();

  // Health check query
  if (/SELECT 1 AS alive/i.test(normalized)) {
    return { rows: [{ alive: 1 }] };
  }

  // Schema initialization queries (No-op in local store)
  if (/CREATE TABLE/i.test(normalized) || /CREATE INDEX/i.test(normalized)) {
    return { rows: [] };
  }

  // 1. INSERT INTO expenses
  if (/^INSERT INTO expenses/i.test(normalized)) {
    const [title, amount, category, expense_date, payment_method, description] = params;
    const newRecord = {
      id: localStore.nextId++,
      title,
      amount: parseFloat(amount),
      category,
      expense_date,
      payment_method: payment_method || 'Cash',
      description: description || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    localStore.expenses.push(newRecord);
    return { rows: [newRecord] };
  }

  // 2. UPDATE expenses
  if (/^UPDATE expenses/i.test(normalized)) {
    const [title, amount, category, expense_date, payment_method, description, id] = params;
    const target = localStore.expenses.find((e) => e.id === parseInt(id, 10));
    if (!target) return { rows: [] };

    target.title = title;
    target.amount = parseFloat(amount);
    target.category = category;
    target.expense_date = expense_date;
    target.payment_method = payment_method || 'Cash';
    target.description = description || null;
    target.updated_at = new Date().toISOString();

    return { rows: [target] };
  }

  // 3. DELETE FROM expenses
  if (/^DELETE FROM expenses/i.test(normalized)) {
    const id = parseInt(params[0], 10);
    const index = localStore.expenses.findIndex((e) => e.id === id);
    if (index === -1) return { rows: [] };

    const deleted = localStore.expenses.splice(index, 1)[0];
    return { rows: [deleted] };
  }

  // 4. SELECT * FROM expenses WHERE id = $1
  if (/SELECT \* FROM expenses WHERE id = \$1/i.test(normalized)) {
    const id = parseInt(params[0], 10);
    const item = localStore.expenses.find((e) => e.id === id);
    return { rows: item ? [item] : [] };
  }

  // 5. Overall summary query
  if (/SELECT\s+COALESCE\(SUM\(amount\),\s*0\)\s+AS\s+total_expenses/i.test(normalized)) {
    const total = localStore.expenses.reduce((sum, e) => sum + e.amount, 0);
    return {
      rows: [{ total_expenses: total.toString(), total_transactions: localStore.expenses.length.toString() }],
    };
  }

  // 6. Current calendar month total
  if (/SELECT\s+COALESCE\(SUM\(amount\),\s*0\)\s+AS\s+this_month/i.test(normalized)) {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthTotal = localStore.expenses
      .filter((e) => (e.expense_date || '').startsWith(currentYearMonth))
      .reduce((sum, e) => sum + e.amount, 0);
    return { rows: [{ this_month: thisMonthTotal.toString() }] };
  }

  // 7. Highest category query
  if (/SELECT\s+category,\s+SUM\(amount\)\s+AS\s+total.*GROUP\s+BY\s+category\s+ORDER\s+BY\s+total\s+DESC\s+LIMIT\s+1/is.test(normalized)) {
    if (localStore.expenses.length === 0) return { rows: [] };
    const sums = {};
    localStore.expenses.forEach((e) => {
      sums[e.category] = (sums[e.category] || 0) + e.amount;
    });
    const sorted = Object.entries(sums).sort((a, b) => b[1] - a[1]);
    return {
      rows: [{ category: sorted[0][0], total: sorted[0][1].toString() }],
    };
  }

  // 8. Category Breakdown query (for categories view and doughnut chart)
  if (/SELECT\s+category,\s*COALESCE\(SUM\(amount\),\s*0\)\s+AS\s+total,\s*COUNT\(\*\)::int\s+AS\s+count.*GROUP BY category/is.test(normalized) && !params.length) {
    const map = {};
    localStore.expenses.forEach((e) => {
      if (!map[e.category]) map[e.category] = { total: 0, count: 0 };
      map[e.category].total += e.amount;
      map[e.category].count += 1;
    });
    const rows = Object.entries(map)
      .map(([category, stats]) => ({
        category,
        total: stats.total.toString(),
        count: stats.count,
      }))
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
    return { rows };
  }

  // 9. Monthly Spending Trend (generate_series simulation for last N months)
  if (/WITH months AS/is.test(normalized)) {
    const monthsCount = parseInt(params[0], 10) || 6;
    const result = [];
    const now = new Date();

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthPadded = String(d.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${monthPadded}`;
      const monthLabel = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });

      const sum = localStore.expenses
        .filter((e) => (e.expense_date || '').startsWith(monthKey))
        .reduce((acc, curr) => acc + curr.amount, 0);

      result.push({
        month_key: monthKey,
        month_label: monthLabel,
        total: sum.toString(),
      });
    }

    return { rows: result };
  }

  // 10. Month Detail Report queries
  if (/WHERE TO_CHAR\(expense_date, 'YYYY-MM'\) = \$1/i.test(normalized)) {
    const monthPrefix = params[0];
    const monthExpenses = localStore.expenses.filter((e) => (e.expense_date || '').startsWith(monthPrefix));

    if (/SELECT\s+COALESCE\(SUM\(amount\)/i.test(normalized)) {
      const sum = monthExpenses.reduce((acc, curr) => acc + curr.amount, 0);
      return { rows: [{ total: sum.toString(), count: monthExpenses.length }] };
    }

    if (/GROUP BY category/i.test(normalized)) {
      const catMap = {};
      monthExpenses.forEach((e) => {
        if (!catMap[e.category]) catMap[e.category] = { total: 0, count: 0 };
        catMap[e.category].total += e.amount;
        catMap[e.category].count += 1;
      });
      const rows = Object.entries(catMap)
        .map(([category, stats]) => ({
          category,
          total: stats.total.toString(),
          count: stats.count,
        }))
        .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
      return { rows };
    }

    // Transactions list
    const sorted = [...monthExpenses].sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date) || b.id - a.id);
    return { rows: sorted };
  }

  // 11. Count query with filters: SELECT COUNT(*) AS count FROM expenses
  if (/SELECT COUNT\(\*\) AS count FROM expenses/i.test(normalized)) {
    let filtered = [...localStore.expenses];

    params.forEach((p) => {
      if (typeof p === 'string' && p.startsWith('%') && p.endsWith('%')) {
        const term = p.slice(1, -1).toLowerCase();
        filtered = filtered.filter(
          (e) => (e.title && e.title.toLowerCase().includes(term)) || (e.description && e.description.toLowerCase().includes(term))
        );
      } else if (typeof p === 'string' && ['Food', 'Transportation', 'Education', 'Shopping', 'Entertainment', 'Healthcare', 'Bills', 'Other'].includes(p)) {
        filtered = filtered.filter((e) => e.category === p);
      } else if (typeof p === 'string' && ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Other'].includes(p)) {
        filtered = filtered.filter((e) => e.payment_method === p);
      } else if (typeof p === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p)) {
        if (/expense_date >= \$/i.test(normalized)) {
          filtered = filtered.filter((e) => e.expense_date >= p);
        } else if (/expense_date <= \$/i.test(normalized)) {
          filtered = filtered.filter((e) => e.expense_date <= p);
        }
      }
    });

    return { rows: [{ count: filtered.length.toString() }] };
  }

  // 12. Main list query: SELECT * FROM expenses ...
  if (/SELECT \* FROM expenses/i.test(normalized)) {
    let filtered = [...localStore.expenses];

    // Filter by criteria
    params.forEach((p) => {
      if (typeof p === 'string' && p.startsWith('%') && p.endsWith('%')) {
        const term = p.slice(1, -1).toLowerCase();
        filtered = filtered.filter(
          (e) => (e.title && e.title.toLowerCase().includes(term)) || (e.description && e.description.toLowerCase().includes(term))
        );
      } else if (typeof p === 'string' && ['Food', 'Transportation', 'Education', 'Shopping', 'Entertainment', 'Healthcare', 'Bills', 'Other'].includes(p)) {
        filtered = filtered.filter((e) => e.category === p);
      } else if (typeof p === 'string' && ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Other'].includes(p)) {
        filtered = filtered.filter((e) => e.payment_method === p);
      }
    });

    // Sorting
    const isAsc = /ASC/i.test(normalized);
    if (/ORDER BY amount/i.test(normalized)) {
      filtered.sort((a, b) => (isAsc ? a.amount - b.amount : b.amount - a.amount));
    } else if (/ORDER BY title/i.test(normalized)) {
      filtered.sort((a, b) => (isAsc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)));
    } else {
      // Default: date desc, id desc
      filtered.sort((a, b) => {
        const cmp = new Date(b.expense_date) - new Date(a.expense_date);
        return isAsc ? -cmp : cmp || b.id - a.id;
      });
    }

    // Pagination
    const limitMatch = normalized.match(/LIMIT \$(\d+)\s+OFFSET \$(\d+)/i);
    if (limitMatch) {
      const limitVal = params[parseInt(limitMatch[1], 10) - 1];
      const offsetVal = params[parseInt(limitMatch[2], 10) - 1];
      filtered = filtered.slice(offsetVal, offsetVal + limitVal);
    }

    // Recent transactions query without offset (e.g. limit=5)
    const simpleLimitMatch = normalized.match(/LIMIT (\d+)/i);
    if (simpleLimitMatch) {
      const limitVal = parseInt(simpleLimitMatch[1], 10);
      filtered = filtered.slice(0, limitVal);
    }

    return { rows: filtered };
  }

  return { rows: [] };
};

/**
 * Main query dispatcher: Routes to PostgreSQL when available, or local fallback
 */
const query = async (text, params) => {
  if (isRealPostgres) {
    return pool.query(text, params);
  }
  return executeLocalQuery(text, params);
};

/**
 * Initialize database schema and indexes automatically
 */
const initDatabase = async (retries = 3, delayMs = 1500) => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      attempt++;
      console.log(`[Database] Connecting to PostgreSQL (Attempt ${attempt}/${retries})...`);

      const client = await pool.connect();
      try {
        console.log('[Database] Connected to PostgreSQL. Initializing schema...');

        // Create expenses table
        await client.query(`
          CREATE TABLE IF NOT EXISTS expenses (
            id SERIAL PRIMARY KEY,
            title VARCHAR(150) NOT NULL,
            amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
            category VARCHAR(50) NOT NULL,
            expense_date DATE NOT NULL,
            payment_method VARCHAR(50),
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Create indexes
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
          CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
          CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
        `);

        isRealPostgres = true;
        console.log('[Database] PostgreSQL schema and indexes initialized successfully.');
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.warn('ℹ️  PostgreSQL not detected on localhost:5432.');
        console.log('⚡ Switched to resilient local store mode for localhost operation.');
        console.log('   (When running via Docker Compose or with PostgreSQL active, PostgreSQL is used automatically).');
        isRealPostgres = false;
        return false;
      }
    }
  }
};

/**
 * Helper to check connection type
 */
const isConnected = () => isRealPostgres;

module.exports = {
  pool,
  query,
  initDatabase,
  isConnected,
};
