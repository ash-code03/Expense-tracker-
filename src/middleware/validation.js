const ALLOWED_CATEGORIES = [
  'Food',
  'Transportation',
  'Education',
  'Shopping',
  'Entertainment',
  'Healthcare',
  'Bills',
  'Other',
];

const ALLOWED_PAYMENT_METHODS = [
  'Cash',
  'UPI',
  'Debit Card',
  'Credit Card',
  'Bank Transfer',
  'Other',
];

/**
 * Validate expense creation and update requests
 */
const validateExpense = (req, res, next) => {
  const { title, amount, category, expense_date, payment_method, description } = req.body;
  const errors = [];

  // Title validation
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Expense title is required and cannot be empty.');
  } else if (title.trim().length > 150) {
    errors.push('Expense title must not exceed 150 characters.');
  }

  // Amount validation
  const parsedAmount = parseFloat(amount);
  if (amount === undefined || amount === null || isNaN(parsedAmount)) {
    errors.push('A valid expense amount is required.');
  } else if (parsedAmount <= 0) {
    errors.push('Expense amount must be greater than zero.');
  }

  // Category validation
  if (!category || typeof category !== 'string' || !ALLOWED_CATEGORIES.includes(category.trim())) {
    errors.push(`Category is required and must be one of: ${ALLOWED_CATEGORIES.join(', ')}.`);
  }

  // Expense date validation
  if (!expense_date) {
    errors.push('Expense date is required.');
  } else {
    const parsedDate = new Date(expense_date);
    if (isNaN(parsedDate.getTime())) {
      errors.push('Expense date must be a valid date format (e.g. YYYY-MM-DD).');
    }
  }

  // Payment method validation (optional, defaults to Other if not specified)
  if (payment_method && !ALLOWED_PAYMENT_METHODS.includes(payment_method.trim())) {
    errors.push(`Payment method must be one of: ${ALLOWED_PAYMENT_METHODS.join(', ')}.`);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  // Sanitize and attach validated fields
  req.sanitizedExpense = {
    title: title.trim(),
    amount: Math.round(parsedAmount * 100) / 100,
    category: category.trim(),
    expense_date: expense_date.trim().substring(0, 10),
    payment_method: payment_method ? payment_method.trim() : 'Cash',
    description: description ? description.trim() : null,
  };

  next();
};

/**
 * Validate expense ID parameter
 */
const validateId = (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid expense ID. ID must be a positive integer.',
    });
  }
  req.expenseId = id;
  next();
};

module.exports = {
  ALLOWED_CATEGORIES,
  ALLOWED_PAYMENT_METHODS,
  validateExpense,
  validateId,
};
