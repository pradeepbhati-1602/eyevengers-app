// ─────────────────────────────────────────────────────────────────
// Express App Setup (separated from server.js for testability)
// ─────────────────────────────────────────────────────────────────

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
const { requireSuperAdmin } = require('./middleware/tenantIsolation');

const app = express();

// ── Security Headers (Helmet) ───────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Allows React frontend scripts and styling
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.disable('x-powered-by'); // Hide Express fingerprint

// ── Rate Limiting (Brute Force & DoS Protection) ─────────────────────
// 1. General API Rate Limiter: 400 requests per minute per IP
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again in a minute.' }
});
app.use('/api/', generalLimiter);

// 2. Strict Auth Limiter: 15 login attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/superadmin/login', authLimiter);

// ── Middleware ─────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Eyevengers Optical API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ── Protected DB utility (Super Admin only) ──────────────────────
app.get('/api/v1/fix-db', requireSuperAdmin, async (req, res) => {
  const { prisma } = require('./prisma');
  try {
    const results = [];
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "items" JSONB;`);
      results.push('Added items column');
    } catch (e) { results.push('Error items: ' + e.message); }
    
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'LENS_TYPE';`);
      results.push('Added LENS_TYPE');
    } catch (e) { results.push('Error LENS_TYPE: ' + e.message); }
    
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'LENS_COATING';`);
      results.push('Added LENS_COATING');
    } catch (e) { results.push('Error LENS_COATING: ' + e.message); }
    
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── API Routes (will be added step by step) ───────────────────────
const apiRoutes = express.Router();
apiRoutes.use('/superadmin', require('./routes/superadmin.routes'));
apiRoutes.use('/auth',       require('./routes/auth.routes'));
apiRoutes.use('/stores',     require('./routes/store.routes'));
apiRoutes.use('/dashboard',  require('./routes/dashboard.routes'));
apiRoutes.use('/customers',  require('./routes/customer.routes'));
apiRoutes.use('/products',   require('./routes/product.routes'));
apiRoutes.use('/bills',      require('./routes/bill.routes'));
apiRoutes.use('/invoices',   require('./routes/invoice.routes'));
apiRoutes.use('/memberships',require('./routes/membership.routes'));
apiRoutes.use('/reports',    require('./routes/report.routes'));
apiRoutes.use('/tenant',     require('./routes/tenant.routes'));
apiRoutes.use('/plan-templates', require('./routes/planTemplate.routes'));
apiRoutes.use('/settings',   require('./routes/settings.routes'));
apiRoutes.use('/repairs',    require('./routes/repair.routes'));
apiRoutes.use('/eyetests',   require('./routes/eyetest.routes'));
apiRoutes.use('/public',     require('./routes/public.routes'));
apiRoutes.use('/transfers',  require('./routes/transfer.routes'));
apiRoutes.use('/stores',     require('./routes/store.routes'));

app.use('/api/v1', apiRoutes);

// ── 404 handler ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('❌ Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

module.exports = app;
