const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./config/database');
const expenseRoutes = require('./routes/expenseRoutes');
const reportRoutes = require('./routes/reportRoutes');
const expenseController = require('./controllers/expenseController');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Core middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const result = await db.query('SELECT 1 AS alive;');
    if (result && result.rows && result.rows[0].alive === 1) {
      dbStatus = 'connected';
    }
  } catch (err) {
    dbStatus = 'error';
  }

  const isHealthy = dbStatus === 'connected';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development',
  });
});

// Dashboard summary endpoint
app.get('/api/summary', expenseController.getSummary);

// API routes
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);

// Fallback for SPA/UI routing - serve index.html for non-API GET requests
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 Handler for undefined API routes
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
