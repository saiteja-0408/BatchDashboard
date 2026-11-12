/**
 * emailReportController.js — handler for POST /api/status-report/email
 *
 * Receives the verification form payload from the frontend and dispatches the
 * status report email via Nodemailer (SMTP) or logs a structured summary when
 * email is not configured (SMTP_HOST not set in environment).
 *
 * Environment variables (all optional — sensible no-op behaviour when absent):
 *   SMTP_HOST         — SMTP server hostname (e.g. smtp.company.com)
 *   SMTP_PORT         — SMTP port (default 587)
 *   SMTP_USER         — SMTP auth username
 *   SMTP_PASS         — SMTP auth password (loaded from environment only)
 *   SMTP_FROM         — Sender address (e.g. "Dashboard <dashboard@company.com>")
 *   EMAIL_REPORT_TO   — Comma-separated recipient list
 *   SMTP_SECURE       — 'true' to enable TLS (default false for port 587 STARTTLS)
 *
 * Security:
 *   - Credentials are read exclusively from environment variables — never from
 *     the request payload.
 *   - Input is validated and sanitised before building the email body.
 *   - Stack traces are never returned to the client (global error handler).
 *
 * Email body format:
 *   HTML email with:
 *     1. Report metadata (ID, timestamp, submitted by)
 *     2. Overall notes
 *     3. Per-category question/answer table
 *
 * When SMTP_HOST is absent the controller logs the payload and returns a
 * success response so the frontend UX works end-to-end without an SMTP server.
 */

'use strict';

const nodemailer = require('nodemailer');
const { queryDb2 } = require('../services/db2Service');

// ── Automated DB Check Queries ────────────────────────────────────────────────

/**
 * Executes one or more SQL queries configured in a single .env variable.
 *
 * Multiple queries are separated by a pipe character `|` inside the env value:
 *   QUERY_BATCH_FAILED=SELECT 1 FROM T WHERE STATUS='F'|SELECT COUNT(*) FROM T2 WHERE ERR=1
 *
 * All queries are run in parallel.  The result is the **union** of all rows
 * returned — so if ANY individual query returns >= 1 row the overall count > 0
 * (status auto-selected as YES).  Errors in one query do not abort the others.
 *
 * Returns { count, rows, configured, errors[] }.
 *   configured — false when the env var is absent / blank (no DB call is made).
 *   errors     — array of error messages from any query that threw (may be empty).
 *
 * @param {string} envVarName
 * @returns {Promise<{ count: number, rows: Array, configured: boolean, errors: string[] }>}
 */
async function executeCheckQuery(envVarName) {
  const raw = process.env[envVarName];
  if (!raw || !raw.trim()) {
    return { count: 0, rows: [], configured: false, errors: [] };
  }

  // Split on `|` and discard blank segments (tolerates trailing pipes / whitespace)
  const statements = raw
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (statements.length === 0) {
    return { count: 0, rows: [], configured: false, errors: [] };
  }

  // Run all statements concurrently; capture errors per-statement
  const results = await Promise.all(
    statements.map(async (sql, idx) => {
      try {
        const rows = await queryDb2(sql);
        return { rows: Array.isArray(rows) ? rows : [], error: null };
      } catch (err) {
        console.warn(
          `[email-report] Query "${envVarName}"[${idx + 1}/${statements.length}] failed: ${err.message}`
        );
        return { rows: [], error: err.message };
      }
    })
  );

  // Aggregate: merge all rows; collect any errors
  const allRows  = results.flatMap((r) => r.rows);
  const errors   = results.map((r) => r.error).filter(Boolean);

  return {
    count:      allRows.length,
    rows:       allRows,
    configured: true,
    errors,
  };
}

/**
 * Resolves email configuration metadata from environment variables.
 *
 * @param {string} [timestamp]
 * @returns {{ from: string, to: string, cc: string, subject: string, senderName: string, senderTitle: string, senderEmail: string, senderPhone: string }}
 */
function getEmailConfig(timestamp) {
  const dateStr = timestamp
    ? new Date(timestamp).toLocaleDateString('en-US')
    : new Date().toLocaleDateString('en-US');

  return {
    from:        process.env.EMAIL_REPORT_FROM || process.env.SMTP_FROM || 'rabatthula@mdes.ms.gov',
    to:          process.env.EMAIL_REPORT_TO || 'team@mdes.ms.gov',
    cc:          process.env.EMAIL_REPORT_CC || '',
    subject:     `[MS Daily Health Check] Verification Status Report — ${dateStr}`,
    senderName:  process.env.EMAIL_SENDER_NAME || 'Ramesh_Batthula',
    senderTitle: process.env.EMAIL_SENDER_TITLE || 'Application Developer',
    senderEmail: process.env.EMAIL_SENDER_EMAIL || 'rabatthula@mdes.ms.gov',
    senderPhone: process.env.EMAIL_SENDER_PHONE || '+1 (904) 408 - 7037',
  };
}

// ── Input validation ──────────────────────────────────────────────────────────

/** Maximum allowed string length for any text field in the payload. */
const MAX_TEXT_LENGTH = 5000;

/**
 * Validates and sanitises the incoming payload.
 * Throws an error with status 400 on invalid input.
 *
 * @param {unknown} body  — raw req.body
 * @returns {{ reportId: string, timestamp: string, submittedBy: string, headerComment: string, answers: object[] }}
 */
function validatePayload(body) {
  if (!body || typeof body !== 'object') {
    const err = new Error('Request body must be a JSON object.');
    err.status = 400;
    throw err;
  }

  const { reportId, timestamp, submittedBy, headerComment, answers } = body;

  if (typeof reportId !== 'string' || !reportId.trim()) {
    const err = new Error('reportId is required and must be a non-empty string.');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(answers) || answers.length === 0) {
    const err = new Error('answers must be a non-empty array.');
    err.status = 400;
    throw err;
  }

  // Sanitise text fields — trim and cap length.
  return {
    reportId:      String(reportId).trim().slice(0, 100),
    timestamp:     typeof timestamp === 'string' ? timestamp.trim().slice(0, 64) : new Date().toISOString(),
    submittedBy:   typeof submittedBy === 'string' ? submittedBy.trim().slice(0, 200) : 'Dashboard User',
    headerComment: typeof headerComment === 'string' ? headerComment.trim().slice(0, MAX_TEXT_LENGTH) : '',
    answers:       answers.map((a) => ({
      questionId:    String(a.questionId ?? '').trim().slice(0, 100),
      questionLabel: String(a.questionLabel ?? '').trim().slice(0, 500),
      value:         String(a.value ?? '').trim().toLowerCase(),
      comment:       String(a.comment ?? '').trim().slice(0, MAX_TEXT_LENGTH),
      category:      typeof a.category === 'string' ? a.category.trim().slice(0, 100) : 'General',
    })),
  };
}

// ── Email body builder ────────────────────────────────────────────────────────

/**
 * Groups answer items by their category field.
 * Preserves insertion order.
 *
 * @param {object[]} answers
 * @returns {Map<string, object[]>}
 */
function groupAnswersByCategory(answers) {
  const map = new Map();
  for (const a of answers) {
    const cat = a.category || 'General';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(a);
  }
  return map;
}

/**
 * Builds the HTML email body matching Screenshots 2, 3, and 4.
 *
 * @param {{ reportId, timestamp, submittedBy, headerComment, answers }} payload
 * @param {Object} [customEmailConfig]
 * @returns {string}  HTML string
 */
function buildEmailHtml(payload, customEmailConfig = null) {
  const { timestamp, headerComment, answers } = payload;
  const cfg = customEmailConfig || getEmailConfig(timestamp);

  const formattedDate = (() => {
    try {
      const d = new Date(timestamp);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    } catch {
      return new Date().toLocaleDateString('en-US');
    }
  })();

  const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Converts plaintext URLs into clickable hyperlinks
  const linkify = (text) => {
    if (!text) return '';
    const escaped = esc(text);
    return escaped.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#0563c1;text-decoration:underline;">$1</a>'
    ).replace(/\n/g, '<br>');
  };

  const categories = groupAnswersByCategory(answers);

  // Build category table rows
  const tableRows = Array.from(categories.entries()).map(([cat, items]) => {
    const isRpa = cat.includes('RPA');
    const headerTitle = isRpa ? `RPA (BOT) Run – ${formattedDate}` : cat;

    const rows = items.map((a) => {
      // Special row handling
      if (a.questionId === 'app-mobile-app-check') {
        return `
          <tr>
            <td style="padding:6px 10px;border:1px solid #000;font-size:13px;font-family:Calibri,Arial,sans-serif;">${esc(a.questionLabel)}</td>
            <td style="padding:6px 10px;border:1px solid #000;font-size:13px;font-family:Calibri,Arial,sans-serif;font-weight:bold;">NOTE - This validation is no longer applicable and can be disregarded.</td>
          </tr>`;
      }

      let statusDisplay = '';
      const upperVal = a.value ? a.value.toUpperCase() : 'YES';
      const commentHtml = linkify(a.comment);

      if (commentHtml) {
        statusDisplay = `${upperVal}-<br>${commentHtml}`;
      } else {
        statusDisplay = upperVal;
      }

      return `
        <tr>
          <td style="padding:6px 10px;border:1px solid #000;font-size:13px;font-family:Calibri,Arial,sans-serif;width:45%;">${esc(a.questionLabel)}</td>
          <td style="padding:6px 10px;border:1px solid #000;font-size:13px;font-family:Calibri,Arial,sans-serif;width:55%;">${statusDisplay}</td>
        </tr>`;
    }).join('');

    return `
      <tr style="background-color:#d9e1f2;">
        <th style="padding:6px 10px;border:1px solid #000;text-align:left;font-size:13px;font-family:Calibri,Arial,sans-serif;font-weight:bold;">${esc(headerTitle)}</th>
        <th style="padding:6px 10px;border:1px solid #000;text-align:left;font-size:13px;font-family:Calibri,Arial,sans-serif;">${cat === 'Application Monitoring' ? '<strong>Verification Status</strong>' : ''}</th>
      </tr>
      ${rows}`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MS Daily Health Check</title>
</head>
<body style="font-family:Calibri,Arial,sans-serif;font-size:14px;color:#000;margin:20px;line-height:1.4;background-color:#ffffff;">

  <div style="margin-bottom:16px;">
    <p style="margin:0 0 12px 0;">Hi All,</p>
    <p style="margin:0 0 16px 0;">Please find the morning health check for today.</p>
  </div>

  ${headerComment ? `
  <div style="background:#f8f9fa;border-left:4px solid #4a7bb0;padding:10px 14px;margin-bottom:16px;max-width:800px;">
    <strong>Notes:</strong>
    <p style="margin:4px 0 0;font-size:13px;">${esc(headerComment).replace(/\n/g, '<br>')}</p>
  </div>` : ''}

  <table style="width:100%;max-width:800px;border-collapse:collapse;border:1px solid #000;margin-bottom:24px;">
    <thead>
      <tr style="background-color:#4a7bb0;">
        <th colspan="2" style="border:1px solid #000;padding:8px 10px;text-align:left;font-size:14px;font-weight:bold;color:#000000;font-family:Calibri,Arial,sans-serif;">
          MS Daily Health Check Activities
        </th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <!-- Signature Block -->
  <div style="margin-top:24px;font-family:Calibri,Arial,sans-serif;font-size:13px;line-height:1.35;color:#000;">
    <div style="font-weight:bold;color:#203764;">${esc(cfg.senderName)}</div>
    <div>${esc(cfg.senderTitle)}</div>
    <div>Email: <a href="mailto:${esc(cfg.senderEmail)}" style="color:#0563c1;text-decoration:underline;">${esc(cfg.senderEmail)}</a></div>
    <div>Contact_On: ${esc(cfg.senderPhone)}</div>
  </div>

</body>
</html>`;
}

// ── Nodemailer transporter (lazy-initialised) ─────────────────────────────────

let _transporter = null;

/**
 * Returns a lazily-created Nodemailer transporter.
 * Returns null when SMTP_HOST is not configured.
 *
 * @returns {import('nodemailer').Transporter | null}
 */
function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // TLS 1.2+ — reject self-signed certificates in production
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });

  return _transporter;
}

// ── Controller ────────────────────────────────────────────────────────────────

/**
 * GET /api/status-report/email/auto-checks
 *
 * Runs database queries from .env for Database Monitoring & Batch Monitoring.
 * Returns evaluated auto-checks and email configuration.
 */
async function getAutoChecks(req, res) {
  const [
    claimFiling,
    weeklyCert,
    monitoringExecution,
    hungBatch,
    failedBatches,
    correspondenceClean,
    failedKafka,
  ] = await Promise.all([
    executeCheckQuery('QUERY_DB_CLAIM_FILING'),
    executeCheckQuery('QUERY_DB_WEEKLY_CERT'),
    executeCheckQuery('QUERY_BATCH_MONITORING_EXECUTION'),
    executeCheckQuery('QUERY_BATCH_HUNG'),
    executeCheckQuery('QUERY_BATCH_FAILED'),
    executeCheckQuery('QUERY_BATCH_CORRESPONDENCE_CLEAN'),
    executeCheckQuery('QUERY_APP_FAILED_KAFKA_RECORDS'),
  ]);

  const autoChecks = {
    // Database Monitoring
    'db-claim-filing': {
      value: claimFiling.configured ? (claimFiling.count >= 1 ? 'yes' : 'no') : 'yes',
      comment: '',
    },
    'db-weekly-cert-filing': {
      value: weeklyCert.configured ? (weeklyCert.count >= 1 ? 'yes' : 'no') : 'yes',
      comment: '',
    },
    // Batch Monitoring — no pre-selection when query not configured.
    'batch-monitoring-execution': {
      value: monitoringExecution.configured ? (monitoringExecution.count >= 1 ? 'yes' : 'no') : '',
      comment: '',
    },
    'batch-hung': {
      value: hungBatch.configured ? (hungBatch.count >= 1 ? 'yes' : 'no') : '',
      comment: '',
    },
    'batch-failed': {
      value: failedBatches.configured ? (failedBatches.count >= 1 ? 'yes' : 'no') : '',
      comment: failedBatches.rows && failedBatches.rows.length > 0
        ? failedBatches.rows.map((r) => r.JOB_NAME || r.job_name || r.name || JSON.stringify(r)).join('\n')
        : '',
    },
    // YES = temp tables are empty (no data = clean).
    // NO  = data found in one or more temp tables (create a defect).
    'batch-correspondence-temp-clean': {
      value: correspondenceClean.configured ? (correspondenceClean.count >= 1 ? 'no' : 'yes') : 'yes',
      comment: correspondenceClean.configured && correspondenceClean.count >= 1
        ? 'Data found in temp tables — create a defect.'
        : '',
    },
    // Application Monitoring — no pre-selection; user must choose manually.
    'app-claimant-login': { value: '', comment: '' },
    'app-employer-login': { value: '', comment: '' },
    'app-internal-user-login': { value: '', comment: '' },
    'app-sso': { value: '', comment: '' },
    'app-my-q': { value: '', comment: '' },
    'app-claimant-inquiry': { value: '', comment: '' },
    'app-view-correspondence-claimant': { value: '', comment: '' },
    'app-employer-inquiry': { value: '', comment: '' },
    'app-view-correspondence-employer': { value: '', comment: '' },
    'app-mobile-app-check': { value: 'na', comment: 'NOTE - This validation is no longer applicable and can be disregarded.' },
    'app-chatbot-check': { value: '', comment: '' },
    'app-failed-kafka-records': {
      // YES when the query finds unprocessed records today; NO otherwise.
      // No pre-selection when the env var is not configured.
      value:   failedKafka.configured ? (failedKafka.count >= 1 ? 'yes' : 'no') : '',
      comment: failedKafka.configured
        ? (failedKafka.count >= 1 ? 'https://reemployusa2022.atlassian.net/browse/CMP-133' : '')
        : '',
    },
    // RPA — no pre-selection; user must choose manually.
    'rpa-ib6-incoming': { value: '', comment: '' },
    'rpa-work-item-assign': { value: '', comment: '' },
    'rpa-name-mismatch': { value: '', comment: '' },
    'rpa-incorrect-wage': { value: '', comment: '' },
    'rpa-process-employer-response': { value: '', comment: '' },
    'rpa-workitem-reassign': { value: '', comment: '' },
  };

  const emailConfig = getEmailConfig();

  return res.status(200).json({
    success: true,
    autoChecks,
    emailConfig,
  });
}

/**
 * POST /api/status-report/email/preview
 *
 * Returns the generated HTML string and metadata for previewing.
 */
async function previewEmailReport(req, res) {
  const payload = validatePayload(req.body);
  const emailConfig = getEmailConfig(payload.timestamp);
  const html = buildEmailHtml(payload, emailConfig);

  return res.status(200).json({
    success: true,
    html,
    emailConfig,
  });
}

/**
 * POST /api/status-report/email
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function sendEmailReport(req, res) {
  const payload = validatePayload(req.body);
  const emailConfig = getEmailConfig(payload.timestamp);
  const transporter = getTransporter();

  if (!transporter) {
    console.log(
      `[email-report] SMTP not configured — logging payload for report ${payload.reportId}:\n` +
      `  From:        ${emailConfig.from}\n` +
      `  To:          ${emailConfig.to}\n` +
      `  Subject:     ${emailConfig.subject}\n` +
      `  Submitted:   ${payload.submittedBy}\n` +
      `  Answers:     ${payload.answers.length} question(s)`
    );
    return res.status(200).json({
      success: true,
      message: 'Email report logged (SMTP not configured).',
      emailId: `LOG-${payload.reportId}`,
    });
  }

  const htmlBody = buildEmailHtml(payload, emailConfig);

  const info = await transporter.sendMail({
    from:    emailConfig.from,
    to:      emailConfig.to,
    cc:      emailConfig.cc || undefined,
    subject: emailConfig.subject,
    html:    htmlBody,
  });

  console.log(`[email-report] Email dispatched. Message ID: ${info.messageId}`);

  return res.status(200).json({
    success: true,
    message: 'Verification status report emailed successfully.',
    emailId: info.messageId,
  });
}

module.exports = { getAutoChecks, previewEmailReport, sendEmailReport };
