/**
 * app.js — Express application entry point
 *
 * Responsibilities:
 *   - Load environment variables
 *   - Bootstrap the data store (parse Excel at startup)
 *   - Mount middleware and routes
 *   - Register global error handler
 *   - Start the HTTP server
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const batchRoutes = require('./routes/batchRoutes');
const { errorHandler } = require('./middlewares/errorHandler');
const excelService = require('./services/excelService');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', batchRoutes);

// ── Serve React build in production ─────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuild));
  app.get('*', (_req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

// ── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

// ── Bootstrap: parse Excel file before accepting requests ────────────────────
async function bootstrap() {
  const excelPath = process.env.EXCEL_FILE_PATH || './data/batches.xlsx';
  const absPath = path.resolve(excelPath);

  // Ensure upload directory exists
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  if (fs.existsSync(absPath)) {
    try {
      await excelService.loadFromFile(absPath);
      console.log(`[startup] Loaded batch data from ${absPath}`);
    } catch (err) {
      console.error(`[startup] Failed to parse Excel file: ${err.message}`);
      console.warn('[startup] Server starting with empty batch store.');
    }
  } else {
    console.warn(`[startup] Excel file not found at ${absPath}. Continuing with empty store.`);
    console.warn('[startup] Use POST /api/upload to load data at runtime.');
  }

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[server] Batch Dashboard API running on http://127.0.0.1:${PORT}`);
  });
}

bootstrap();
