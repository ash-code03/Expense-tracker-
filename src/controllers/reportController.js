const reportService = require('../services/reportService');

/**
 * Controller to get monthly trend report
 */
const getMonthlySpending = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months, 10) || 6;
    const data = await reportService.getMonthlySpending(months);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to get category breakdown report
 */
const getCategoryBreakdown = async (req, res, next) => {
  try {
    const data = await reportService.getCategoryBreakdown();
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to get detailed monthly report
 */
const getMonthDetailReport = async (req, res, next) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;

    const data = await reportService.getMonthDetailReport(year, month);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMonthlySpending,
  getCategoryBreakdown,
  getMonthDetailReport,
};
