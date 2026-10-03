require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/error');

// Import modular API route handlers
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chamberRoutes = require('./routes/chamberRoutes');
const batchRoutes = require('./routes/batchRoutes');
const allocationRoutes = require('./routes/allocationRoutes');
const alertRoutes = require('./routes/alertRoutes');
const dispatchRoutes = require('./routes/dispatchRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const rentRoutes = require('./routes/rentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const taskRoutes = require('./routes/taskRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditRoutes = require('./routes/auditRoutes');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Trust proxy for cookies behind reverse proxies if production
if (isProduction) {
  app.set('trust proxy', 1);
}

// Allowed client origins (handles Next.js port 3000 and Vite port 5173)
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

// CORS setup with credentials support
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev to avoid CORS blocking
    },
    credentials: true,
  })
);

// Standard JSON and URL-encoded body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostgreSQL-backed express-session
const sessionStore = new pgSession({
  pool,
  tableName: 'session',
  createTableIfMissing: true,
});

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'coldstorage_secret_key_default',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Refreshes idle timer on authenticated requests (contract rule US-01 / NFR-2)
    cookie: {
      maxAge: 10 * 60 * 1000, // 10 minutes inactivity timeout
      httpOnly: true, // Prevents XSS cookie theft
      secure: isProduction, // HTTPS only in production
      sameSite: isProduction ? 'none' : 'lax', // Supports cross-site cookie in dev/prod
    },
  })
);

const path = require('path');

// Interactive Swagger UI documentation
const docsHandler = (req, res) => {
  res.sendFile(path.join(__dirname, 'docs.html'));
};
app.get('/docs', docsHandler);
app.get('/api/docs', docsHandler);

// API root discovery endpoint
const apiIndexHandler = (req, res) => {
  res.status(200).json({
    name: 'Cold Storage Warehouse Management System API',
    version: '1.0.0',
    documentation: '/docs',
    health: '/api/health',
    endpoints: {
      auth: ['/api/auth/login', '/api/auth/me', '/api/auth/logout'],
      users: ['/api/users'],
      chambers: ['/api/chambers'],
      batches: ['/api/batches'],
      allocations: ['/api/allocations'],
      withdrawals: ['/api/withdrawals'],
      dispatches: ['/api/dispatches'],
      alerts: ['/api/alerts'],
      rent: ['/api/rent', '/api/rent/calculate'],
      payments: ['/api/payments'],
      tasks: ['/api/tasks'],
      reports: ['/api/reports/overview', '/api/reports/revenue', '/api/reports/operations'],
      auditLogs: ['/api/audit-logs'],
    },
  });
};
app.get('/', apiIndexHandler);
app.get('/api', apiIndexHandler);

// Health check endpoint (NFR-6)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Mount all contract-defined API routes (10 Stories + NFRs)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chambers', chamberRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/rent', rentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);

// Centralized 404 and Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
