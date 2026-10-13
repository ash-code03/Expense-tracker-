const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/monthly', reportController.getMonthlySpending);
router.get('/categories', reportController.getCategoryBreakdown);
router.get('/month-detail', reportController.getMonthDetailReport);

module.exports = router;
