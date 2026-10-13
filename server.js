require('dotenv').config();
const app = require('./src/app');
const { initDatabase, pool } = require('./src/config/database');

const PORT = process.env.PORT || 3000;

let server;

async function startServer() {
  try {
    console.log('='.repeat(50));
    console.log(' Starting ExpenseTrack Backend Application');
    console.log('='.repeat(50));

    // Initialize database schema and indexes
    try {
      await initDatabase();
      console.log(' Database initialization completed.');
    } catch (dbError) {
      console.warn('⚠️ Warning: Database initialization failed on startup.');
      console.warn(` Reason: ${dbError.message}`);
      console.warn(' Server will still start to respond to health probes and allow retries.');
    }

    // Start Express server
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 ExpenseTrack server running at http://localhost:${PORT}`);
      console.log(`📊 Health check available at http://localhost:${PORT}/api/health`);
      console.log(`💻 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(50));
    });

  } catch (error) {
    console.error('❌ Failed to start application:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown handling
const handleGracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await pool.end();
        console.log('PostgreSQL connection pool closed.');
      } catch (poolErr) {
        console.error('Error closing database pool:', poolErr.message);
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

startServer();
