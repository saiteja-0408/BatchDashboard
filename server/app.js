/**
 * app.js — Express application entry point
 *
 * Responsibilities:
 *   - Load environment variables
 *   - Bootstrap the data store (parse both Excel files at startup)
 *   - Mount middleware and routes
 *   - Register global error handler
 *   - Start the HTTP server
 *
 * Data loading:
 *   Reads data/benefits.xlsx and data/tax.xlsx from the project data directory.
 *   To update what the app shows, edit those files and restart the server.
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const batchRoutes              = require('./routes/batchRoutes');
const { errorHandler }         = require('./middlewares/errorHandler');
const excelService             = require('./services/excelService');
const { logStartupMode }       = require('./services/db2Service');

const app  = express();
const PORT = process.env.PORT || 4000;

// ERR-04: track whether bootstrap completed successfully so the health check
// reflects the actual server readiness rather than always returning "ok".
let _bootstrapOk = false;

// ── Middleware ────────────────────────────────────────────────────────────────
// SEC-05: restrict CORS to known origins.
// In development CORS_ORIGIN is typically not set — allow the Vite dev server.
// In production set CORS_ORIGIN to the exact client URL (e.g. https://dashboard.example.com).
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (same-origin, curl, Postman, server-to-server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin "${origin}" not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────────
// ERR-04: report bootstrap status so load balancers / k8s probes can distinguish
// "server started but data not loaded" from "fully operational".
app.get('/health', (_req, res) => {
  if (!_bootstrapOk) {
    return res.status(503).json({ status: 'starting', ts: new Date().toISOString() });
  }
  return res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api', batchRoutes);

// ── Serve React build in production ──────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuild));
  app.get('*', (_req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ── Bootstrap: read both Excel files before accepting requests ────────────────
async function bootstrap() {
  const dataDir = path.resolve(process.env.DATA_DIR || './data');
  const benefitsPath = process.env.BENEFITS_EXCEL_PATH
    ? path.resolve(process.env.BENEFITS_EXCEL_PATH)
    : path.join(dataDir, 'benefits.xlsx');
  const taxPath = process.env.TAX_EXCEL_PATH
    ? path.resolve(process.env.TAX_EXCEL_PATH)
    : path.join(dataDir, 'tax.xlsx');

  const missingFiles = [
    { label: 'benefits workbook', absPath: benefitsPath },
    { label: 'tax workbook',      absPath: taxPath },
  ].filter(({ absPath }) => !fs.existsSync(absPath));

  if (missingFiles.length > 0) {
    missingFiles.forEach(({ label, absPath }) =>
      console.warn(`[startup] WARNING: ${label} not found at ${absPath}`)
    );
  }

  try {
    const { count } = await excelService.loadFromFiles(benefitsPath, taxPath);
    console.log(`[startup] Loaded ${count} batch(es) from benefits & tax files`);
    _bootstrapOk = true;
  } catch (err) {
    console.error(`[startup] Failed to load Excel files: ${err.message}`);
    console.warn('[startup] Server starting with empty batch store.');
    // _bootstrapOk remains false — health check will report 503 until a successful reload
  }

  // Log DB2 / mock mode so the operator can see at a glance which data source is active
  logStartupMode();

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[server] Batch Dashboard API running on http://127.0.0.1:${PORT}`);
  });
}

bootstrap();
