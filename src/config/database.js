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
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

// Keep track of pool connection errors to avoid crash
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

/**
 * Execute a query with safety wrapper
 */
const query = (text, params) => pool.query(text, params);

/**
 * Initialize database schema and indexes automatically
 */
const initDatabase = async (retries = 5, delayMs = 3000) => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      attempt++;
      console.log(`[Database] Connecting to PostgreSQL (Attempt ${attempt}/${retries})...`);
      
      const client = await pool.connect();
      try {
        console.log('[Database] Connected successfully. Initializing schema...');

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

        // Create indexes for fast lookup and reporting
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
        `);

        console.log('[Database] Schema and indexes initialized successfully.');
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`[Database] Connection attempt ${attempt} failed: ${error.message}`);
      if (attempt < retries) {
        console.log(`[Database] Retrying in ${delayMs / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.error('[Database] All connection attempts failed. Check PostgreSQL availability and credentials.');
        throw error;
      }
    }
  }
};

module.exports = {
  pool,
  query,
  initDatabase,
};
