/**
 * batchRoutes.js — Express Router wiring all batch endpoints.
 *
 * Route order matters:
 *   /batches/summary, /batches/search, /batches/filter, /batches/upload must
 *   be declared BEFORE /batches/:name to prevent Express matching those literal
 *   segments as an :name param.
 */

'use strict';

const express = require('express');
const multer  = require('multer');

const controller             = require('../controllers/batchController');
const uploadController       = require('../controllers/uploadController');
const currentTasksController = require('../controllers/currentTasksController');
const statusReportController = require('../controllers/statusReportController');
const { asyncWrapper }       = require('../middlewares/errorHandler');

// multer memory storage — file bytes land in req.file.buffer; nothing touches disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

const router = express.Router();

// ── Batch routes ──────────────────────────────────────────────────────────────
router.get('/batches',                 asyncWrapper(controller.getAllBatches));
router.get('/batches/summary',         asyncWrapper(controller.getSummary));
router.get('/batches/search',          asyncWrapper(controller.searchBatches));
router.get('/batches/filter',          asyncWrapper(controller.filterBatches));
// Upload must be before /:name to avoid ambiguous route matching
router.post('/batches/upload/:sheet',  upload.single('file'), asyncWrapper(uploadController.uploadSheet));
router.get('/batches/:name',           asyncWrapper(controller.getBatchByName));

// ── Current-tasks route ───────────────────────────────────────────────────────
router.get('/current-tasks',   asyncWrapper(currentTasksController.getCurrentTasks));

// ── Status report route ───────────────────────────────────────────────────────
router.get('/status-report',   asyncWrapper(statusReportController.getStatusReport));

module.exports = router;
