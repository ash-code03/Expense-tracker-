const expenseService = require('../services/expenseService');

/**
 * Controller to create an expense
 */
const createExpense = async (req, res, next) => {
  try {
    const expense = await expenseService.createExpense(req.sanitizedExpense);
    res.status(201).json({
      success: true,
      message: 'Expense created successfully.',
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to retrieve expenses list
 */
const getExpenses = async (req, res, next) => {
  try {
    const { search, category, payment_method, startDate, endDate, sortBy, sortOrder, page, limit } = req.query;

    const result = await expenseService.getExpenses({
      search,
      category,
      payment_method,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result.expenses,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to retrieve single expense by ID
 */
const getExpenseById = async (req, res, next) => {
  try {
    const expense = await expenseService.getExpenseById(req.expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: `Expense with ID ${req.expenseId} not found.`,
      });
    }

    res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to update an expense
 */
const updateExpense = async (req, res, next) => {
  try {
    const updated = await expenseService.updateExpense(req.expenseId, req.sanitizedExpense);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Expense with ID ${req.expenseId} not found.`,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Expense updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to delete an expense
 */
const deleteExpense = async (req, res, next) => {
  try {
    const deleted = await expenseService.deleteExpense(req.expenseId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Expense with ID ${req.expenseId} not found.`,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully.',
      data: deleted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to get summary analytics
 */
const getSummary = async (req, res, next) => {
  try {
    const summary = await expenseService.getSummary();
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getSummary,
};
