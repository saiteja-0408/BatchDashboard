/**
 * batchRoutes.js — Express Router wiring all batch endpoints.
 *
 * Route order matters:
 *   /batches/summary, /batches/search, /batches/filter must be declared
 *   BEFORE /batches/:id to prevent Express matching "summary" as an :id param.
 */

'use strict';

const express = require('express');

const controller             = require('../controllers/batchController');
const currentTasksController = require('../controllers/currentTasksController');
const statusReportController = require('../controllers/statusReportController');
const { asyncWrapper }       = require('../middlewares/errorHandler');

const router = express.Router();

// ── Batch routes ──────────────────────────────────────────────────────────────
router.get('/batches',         asyncWrapper(controller.getAllBatches));
router.get('/batches/summary', asyncWrapper(controller.getSummary));
router.get('/batches/search',  asyncWrapper(controller.searchBatches));
router.get('/batches/filter',  asyncWrapper(controller.filterBatches));
router.get('/batches/:name',   asyncWrapper(controller.getBatchByName));

// ── Current-tasks route ───────────────────────────────────────────────────────
router.get('/current-tasks',   asyncWrapper(currentTasksController.getCurrentTasks));

// ── Status report route ───────────────────────────────────────────────────────
router.get('/status-report',   asyncWrapper(statusReportController.getStatusReport));

module.exports = router;
