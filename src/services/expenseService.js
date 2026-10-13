const db = require('../config/database');

/**
 * Create a new expense record
 */
const createExpense = async ({ title, amount, category, expense_date, payment_method, description }) => {
  const query = `
    INSERT INTO expenses (title, amount, category, expense_date, payment_method, description)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [title, amount, category, expense_date, payment_method, description];
  const { rows } = await db.query(query, values);
  return rows[0];
};

/**
 * Retrieve expenses with filtering, search, sorting, and pagination
 */
const getExpenses = async ({
  search,
  category,
  payment_method,
  startDate,
  endDate,
  sortBy = 'expense_date',
  sortOrder = 'DESC',
  page = 1,
  limit = 20,
}) => {
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (search && search.trim()) {
    conditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
    values.push(`%${search.trim()}%`);
    paramIndex++;
  }

  if (category && category.trim()) {
    conditions.push(`category = $${paramIndex}`);
    values.push(category.trim());
    paramIndex++;
  }

  if (payment_method && payment_method.trim()) {
    conditions.push(`payment_method = $${paramIndex}`);
    values.push(payment_method.trim());
    paramIndex++;
  }

  if (startDate) {
    conditions.push(`expense_date >= $${paramIndex}`);
    values.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    conditions.push(`expense_date <= $${paramIndex}`);
    values.push(endDate);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching records
  const countQuery = `SELECT COUNT(*) AS count FROM expenses ${whereClause};`;
  const countResult = await db.query(countQuery, values);
  const total = parseInt(countResult.rows[0].count, 10);

  // Sorting whitelist
  const allowedSortColumns = {
    expense_date: 'expense_date',
    amount: 'amount',
    title: 'title',
    created_at: 'created_at',
  };
  const column = allowedSortColumns[sortBy] || 'expense_date';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  let paginationClause = '';
  const parsedLimit = parseInt(limit, 10) || 20;
  const parsedPage = parseInt(page, 10) || 1;
  const offset = (parsedPage - 1) * parsedLimit;

  // If limit is -1 or very large (like for reports or all items)
  if (limit !== 'all') {
    paginationClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(parsedLimit, offset);
  }

  const selectQuery = `
    SELECT * FROM expenses
    ${whereClause}
    ORDER BY ${column} ${order}, id DESC
    ${paginationClause};
  `;

  const { rows } = await db.query(selectQuery, values);

  return {
    expenses: rows,
    pagination: {
      total,
      page: parsedPage,
      limit: limit === 'all' ? total : parsedLimit,
      totalPages: limit === 'all' ? 1 : Math.ceil(total / parsedLimit) || 1,
    },
  };
};

/**
 * Retrieve a single expense by ID
 */
const getExpenseById = async (id) => {
  const query = 'SELECT * FROM expenses WHERE id = $1;';
  const { rows } = await db.query(query, [id]);
  return rows[0] || null;
};

/**
 * Update an existing expense
 */
const updateExpense = async (id, { title, amount, category, expense_date, payment_method, description }) => {
  const query = `
    UPDATE expenses
    SET title = $1,
        amount = $2,
        category = $3,
        expense_date = $4,
        payment_method = $5,
        description = $6,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
    RETURNING *;
  `;
  const values = [title, amount, category, expense_date, payment_method, description, id];
  const { rows } = await db.query(query, values);
  return rows[0] || null;
};

/**
 * Delete an expense
 */
const deleteExpense = async (id) => {
  const query = 'DELETE FROM expenses WHERE id = $1 RETURNING *;';
  const { rows } = await db.query(query, [id]);
  return rows[0] || null;
};

/**
 * Get dashboard summary calculations
 */
const getSummary = async () => {
  // 1. Overall total and count
  const overallQuery = `
    SELECT 
      COALESCE(SUM(amount), 0) AS total_expenses,
      COUNT(*) AS total_transactions
    FROM expenses;
  `;
  const overallResult = await db.query(overallQuery);
  const totalExpenses = parseFloat(overallResult.rows[0].total_expenses) || 0;
  const totalTransactions = parseInt(overallResult.rows[0].total_transactions, 10) || 0;

  // 2. Current calendar month total
  const monthQuery = `
    SELECT COALESCE(SUM(amount), 0) AS this_month
    FROM expenses
    WHERE expense_date >= DATE_TRUNC('month', CURRENT_DATE)
      AND expense_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month');
  `;
  const monthResult = await db.query(monthQuery);
  const thisMonthExpenses = parseFloat(monthResult.rows[0].this_month) || 0;

  // 3. Highest spending category
  const highestCategoryQuery = `
    SELECT category, SUM(amount) AS total
    FROM expenses
    GROUP BY category
    ORDER BY total DESC
    LIMIT 1;
  `;
  const highestCategoryResult = await db.query(highestCategoryQuery);
  const highestCategory = highestCategoryResult.rows.length > 0
    ? {
        name: highestCategoryResult.rows[0].category,
        amount: parseFloat(highestCategoryResult.rows[0].total) || 0,
      }
    : {
        name: 'None',
        amount: 0,
      };

  return {
    totalExpenses,
    thisMonthExpenses,
    highestCategory,
    totalTransactions,
  };
};

module.exports = {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getSummary,
};
