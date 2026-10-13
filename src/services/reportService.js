const db = require('../config/database');

/**
 * Retrieve monthly spending over the last N months (default: 6)
 * Uses calendar month series so that months with zero spending are included with total 0
 */
const getMonthlySpending = async (monthsCount = 6) => {
  const query = `
    WITH months AS (
      SELECT 
        TO_CHAR(d, 'YYYY-MM') AS month_key,
        TO_CHAR(d, 'Mon YYYY') AS month_label,
        DATE_TRUNC('month', d) AS month_start
      FROM generate_series(
        DATE_TRUNC('month', CURRENT_DATE) - (($1::int - 1) || ' months')::interval,
        DATE_TRUNC('month', CURRENT_DATE),
        INTERVAL '1 month'
      ) AS d
    )
    SELECT 
      m.month_key,
      m.month_label,
      COALESCE(SUM(e.amount), 0) AS total
    FROM months m
    LEFT JOIN expenses e ON TO_CHAR(e.expense_date, 'YYYY-MM') = m.month_key
    GROUP BY m.month_key, m.month_label, m.month_start
    ORDER BY m.month_start ASC;
  `;

  const { rows } = await db.query(query, [monthsCount]);
  return rows.map((r) => ({
    key: r.month_key,
    label: r.month_label,
    total: parseFloat(r.total) || 0,
  }));
};

/**
 * Retrieve category-wise spending distribution with totals, counts, and percentages
 */
const getCategoryBreakdown = async () => {
  const query = `
    SELECT 
      category,
      COALESCE(SUM(amount), 0) AS total,
      COUNT(*)::int AS count
    FROM expenses
    GROUP BY category
    ORDER BY total DESC;
  `;

  const { rows } = await db.query(query);

  const overallSum = rows.reduce((acc, curr) => acc + parseFloat(curr.total), 0);

  return rows.map((row) => {
    const total = parseFloat(row.total);
    const percentage = overallSum > 0 ? Math.round((total / overallSum) * 1000) / 10 : 0;
    return {
      category: row.category,
      total,
      count: row.count,
      percentage,
    };
  });
};

/**
 * Retrieve detailed report for a specific calendar month
 */
const getMonthDetailReport = async (year, month) => {
  // Format target date prefix: e.g. 2026-10
  const paddedMonth = String(month).padStart(2, '0');
  const monthPrefix = `${year}-${paddedMonth}`;

  // 1. Overall stats for that month
  const statsQuery = `
    SELECT 
      COALESCE(SUM(amount), 0) AS total,
      COUNT(*)::int AS count
    FROM expenses
    WHERE TO_CHAR(expense_date, 'YYYY-MM') = $1;
  `;
  const statsResult = await db.query(statsQuery, [monthPrefix]);
  const total = parseFloat(statsResult.rows[0].total) || 0;
  const count = statsResult.rows[0].count || 0;

  // 2. Category breakdown for that month
  const catQuery = `
    SELECT 
      category,
      COALESCE(SUM(amount), 0) AS total,
      COUNT(*)::int AS count
    FROM expenses
    WHERE TO_CHAR(expense_date, 'YYYY-MM') = $1
    GROUP BY category
    ORDER BY total DESC;
  `;
  const catResult = await db.query(catQuery, [monthPrefix]);
  const categories = catResult.rows.map((row) => {
    const catTotal = parseFloat(row.total);
    const percentage = total > 0 ? Math.round((catTotal / total) * 1000) / 10 : 0;
    return {
      category: row.category,
      total: catTotal,
      count: row.count,
      percentage,
    };
  });

  // 3. Transactions for that month
  const txQuery = `
    SELECT *
    FROM expenses
    WHERE TO_CHAR(expense_date, 'YYYY-MM') = $1
    ORDER BY expense_date DESC, id DESC;
  `;
  const txResult = await db.query(txQuery, [monthPrefix]);

  return {
    monthPrefix,
    total,
    count,
    categories,
    transactions: txResult.rows,
  };
};

module.exports = {
  getMonthlySpending,
  getCategoryBreakdown,
  getMonthDetailReport,
};
