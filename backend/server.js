import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIo } from 'socket.io';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Startup validation (before anything else)
import { validateEnv } from './validate-env.js';
validateEnv();

// DB — auto-migrates in development
import db from './db/sqlite.js';
import { seedAuditChecks } from './db/seed/audit-checks.js';

// Middleware
import { authMiddleware } from './middleware/auth.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Routes
import authRoutes      from './routes/auth.js';
import sitesRoutes     from './routes/sites.js';
import crawlsRoutes    from './routes/crawls.js';
import errorsRoutes    from './routes/errors.js';
import reportsRoutes   from './routes/reports.js';
import companiesRoutes from './routes/companies.js';
import auditLogRoutes  from './routes/audit-log.js';
import adsRoutes       from './routes/ads.js';
import settingsRoutes  from './routes/settings.js';
import gscRoutes       from './routes/gsc.js';
import ga4Routes       from './routes/ga4.js';
import psiRoutes       from './routes/psi.js';
import aiRoutes        from './routes/ai.js';
import dashboardRoutes from './routes/dashboard.js';
import tasksRoutes      from './routes/tasks.js';
import schedulesRoutes  from './routes/schedules.js';
import notificationsRoutes from './routes/notifications.js';
import exportsRoutes       from './routes/exports.js';
import compareRoutes       from './routes/compare.js';
import { resetStuckJobs, getJobUrlBuffer } from './services/crawl-runner.js';
import { initScheduler } from './services/schedule.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// Trust the first proxy hop (ngrok, localhost.run, Cloudflare, etc.)
// Required for express-rate-limit and secure cookies to work correctly behind tunnels.
app.set('trust proxy', 1);

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // unsafe-inline needed only in dev (Vite HMR); production build uses external script files only
      scriptSrc:  process.env.NODE_ENV === 'production'
        ? ["'self'"]
        : ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://api.anthropic.com"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ─── Parsing ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new SocketIo(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Attach io to app for use in routes
app.set('io', io);

io.on('connection', (socket) => {
  socket.on('join:job', (jobId) => {
    socket.join(`job:${jobId}`);
    // Replay buffered URL events so late-joining clients see what was already crawled
    const buf = getJobUrlBuffer(jobId);
    if (buf.length > 0) socket.emit('crawl:urls:replay', buf);
  });
  socket.on('leave:job', (jobId) => socket.leave(`job:${jobId}`));
  socket.on('join:company',  (companyId) => socket.join(`company:${companyId}`));
  socket.on('leave:company', (companyId) => socket.leave(`company:${companyId}`));
});

// ─── Global Auth ─────────────────────────────────────────────────────────────
// Applied BEFORE all routes. Routes opt OUT via PUBLIC_PATHS in auth middleware.
app.use(authMiddleware);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ─── Health endpoint (public) ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const vars = {
    JWT_SECRET:        process.env.JWT_SECRET        ? 'set' : 'missing',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'set' : 'missing',
    GOOGLE_CLIENT_ID:  process.env.GOOGLE_CLIENT_ID  ? 'set' : 'missing',
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL ? 'set' : 'missing',
    SMTP_HOST:         process.env.SMTP_HOST         ? 'set' : 'missing',
    PSI_API_KEY:       process.env.PSI_API_KEY       ? 'set' : 'missing',
  };

  res.json({
    status:      'ok',
    version:     '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp:   new Date().toISOString(),
    crawler:     'playwright',
    vars,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/sites',     sitesRoutes);
app.use('/api/crawls',    crawlsRoutes);
app.use('/api/errors',    errorsRoutes);
app.use('/api/reports',   reportsRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/ads',       adsRoutes);
app.use('/api/settings',  settingsRoutes);
app.use('/api/gsc',       gscRoutes);
app.use('/api/ga4',       ga4Routes);
app.use('/api/psi',       psiRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tasks',     tasksRoutes);
app.use('/api/schedules',      schedulesRoutes);
app.use('/api/notifications',  notificationsRoutes);
app.use('/api/exports',       exportsRoutes);
app.use('/api/compare',       compareRoutes);

// Placeholder 501 for routes not yet implemented (Phase 3+)
app.use('/api', (req, res) => {
  res.status(501).json({ error: 'This endpoint is not yet implemented. Coming in a future phase.' });
});

// ─── Serve Frontend (when built) ─────────────────────────────────────────────
// Serves the frontend build from backend/public — used for single-tunnel public
// testing (ngrok/Cloudflare) and production. Skipped automatically if the build
// directory doesn't exist (i.e. during normal `npm run dev` with Vite).
const distPath = join(__dirname, 'public');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// ─── Error handler ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Startup cleanup ─────────────────────────────────────────────────────────
// Reset any jobs that were left running when the server last stopped
resetStuckJobs();

// ─── Seed audit checks ───────────────────────────────────────────────────────
const seeded = seedAuditChecks(db);
if (seeded > 0) console.log(`[seed] Inserted ${seeded} audit checks`);

// ─── Scheduled crawls ────────────────────────────────────────────────────────
initScheduler(db, io);

// ─── Start (only when run directly, not when imported by tests) ──────────────
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const PORT = parseInt(process.env.PORT || '3001', 10);
  httpServer.listen(PORT, () => {
    console.log(`\n[server] SEO Audit Platform v2.0.0`);
    console.log(`[server] Listening on http://localhost:${PORT}`);
    console.log(`[server] Crawler: playwright`);
    console.log(`[server] Env:  ${process.env.NODE_ENV || 'development'}\n`);
  });
}

export default app;
