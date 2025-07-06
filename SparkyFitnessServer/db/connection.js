const { Pool } = require('pg');
const { log } = require('../config/logging'); // Assuming logging.js will be created here

// Initialize PostgreSQL client globally
const pool = new Pool({
  user: process.env.SPARKY_FITNESS_DB_USER,
  host: process.env.SPARKY_FITNESS_DB_HOST,
  database: process.env.SPARKY_FITNESS_DB_NAME,
  password: process.env.SPARKY_FITNESS_DB_PASSWORD,
  port: process.env.SPARKY_FITNESS_DB_PORT,
});

pool.on('error', (err, client) => {
  log('error', 'Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;