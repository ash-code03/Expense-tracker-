const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { validateExpense, validateId } = require('../middleware/validation');

// CRUD endpoints
router.post('/', validateExpense, expenseController.createExpense);
router.get('/', expenseController.getExpenses);
router.get('/:id', validateId, expenseController.getExpenseById);
router.put('/:id', validateId, validateExpense, expenseController.updateExpense);
router.delete('/:id', validateId, expenseController.deleteExpense);

module.exports = router;
