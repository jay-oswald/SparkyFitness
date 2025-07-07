const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load .env from root directory

const express = require('express');
const cors = require('cors'); // Added this line
const pool = require('./db/connection');
const { log } = require('./config/logging');
const { getDefaultModel } = require('./ai/config');
const { authenticateToken } = require('./middleware/authMiddleware');
const foodRoutes = require('./routes/foodRoutes');
const reportRoutes = require('./routes/reportRoutes');
const preferenceRoutes = require('./routes/preferenceRoutes');
const chatRoutes = require('./routes/chatRoutes');
const measurementRoutes = require('./routes/measurementRoutes');
const goalRoutes = require('./routes/goalRoutes');
const exerciseRoutes = require('./routes/exerciseRoutes');
const exerciseEntryRoutes = require('./routes/exerciseEntryRoutes');
const healthDataRoutes = require('./integrations/healthData/healthDataRoutes');
const authRoutes = require('./routes/authRoutes');
const { applyMigrations } = require('./utils/dbMigrations');
const errorHandler = require('./middleware/errorHandler'); // Import the new error handler

const app = express();
const PORT = process.env.SPARKY_FITNESS_SERVER_PORT || 3010;

console.log(`DEBUG: SPARKY_FITNESS_FRONTEND_URL is: ${process.env.SPARKY_FITNESS_FRONTEND_URL}`);

// Use cors middleware to allow requests from your frontend
app.use(cors({
  origin: process.env.SPARKY_FITNESS_FRONTEND_URL || 'http://localhost:8080', // Allow requests from your frontend's origin, fallback to localhost
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Explicitly allow common methods
  allowedHeaders: ['Content-Type', 'Authorization', 'x-provider-id', 'x-api-key'], // Explicitly allow headers, including custom ones
}));

// Middleware to parse JSON bodies for all incoming requests
app.use(express.json());

// Apply authentication middleware to all /api routes except auth
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/login') || req.path.startsWith('/auth/register')) {
    return next(); // Skip authentication for login and register
  }
  authenticateToken(req, res, next);
});

// Link all routes
app.use('/api/chat', chatRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/user-preferences', preferenceRoutes);
app.use('/api/measurements', measurementRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/user-goals', goalRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/exercise-entries', exerciseEntryRoutes);
app.use('/api/health-data', healthDataRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', authRoutes);


console.log('DEBUG: Attempting to start server...');
applyMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`DEBUG: Server started and listening on port ${PORT}`); // Direct console log
    log('info', `SparkyFitnessServer listening on port ${PORT}`);
  });
}).catch(error => {
  log('error', 'Failed to apply migrations and start server:', error);
  process.exit(1);
});

// Centralized error handling middleware - MUST be placed after all routes and other middleware
app.use(errorHandler);

// Catch-all for 404 Not Found - MUST be placed after all routes and error handlers
app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found", message: `The requested URL ${req.originalUrl} was not found on this server.` });
});