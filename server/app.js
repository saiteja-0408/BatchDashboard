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

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

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
  } catch (err) {
    console.error(`[startup] Failed to load Excel files: ${err.message}`);
    console.warn('[startup] Server starting with empty batch store.');
  }

  // Log DB2 / mock mode so the operator can see at a glance which data source is active
  logStartupMode();

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[server] Batch Dashboard API running on http://127.0.0.1:${PORT}`);
  });
}

bootstrap();
