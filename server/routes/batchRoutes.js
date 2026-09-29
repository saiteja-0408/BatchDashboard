/**
 * batchRoutes.js — Express Router wiring all batch endpoints.
 *
 * Route order matters:
 *   /batches/summary, /batches/search, /batches/filter must be declared
 *   BEFORE /batches/:id to prevent Express matching "summary" as an :id param.
 */

const express = require('express');
const path = require('path');
const multer = require('multer');

const controller = require('../controllers/batchController');
const { asyncWrapper } = require('../middlewares/errorHandler');

const router = express.Router();

// ── Multer: store uploaded files in UPLOAD_DIR with original extension ────────
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    cb(null, `upload_${ts}_${file.originalname}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only .xlsx and .xls files are allowed.'));
    }
    cb(null, true);
  },
});

// ── Batch routes ──────────────────────────────────────────────────────────────
router.get('/batches',             asyncWrapper(controller.getAllBatches));
router.get('/batches/summary',     asyncWrapper(controller.getSummary));
router.get('/batches/search',      asyncWrapper(controller.searchBatches));
router.get('/batches/filter',      asyncWrapper(controller.filterBatches));
router.get('/batches/:id',         asyncWrapper(controller.getBatchById));

// ── File upload ───────────────────────────────────────────────────────────────
router.post('/upload', upload.single('file'), asyncWrapper(controller.uploadExcel));

module.exports = router;
