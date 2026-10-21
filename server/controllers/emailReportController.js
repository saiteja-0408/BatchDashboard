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
 * Builds the HTML email body.
 *
 * @param {{ reportId, timestamp, submittedBy, headerComment, answers }} payload
 * @returns {string}  HTML string
 */
function buildEmailHtml(payload) {
  const { reportId, timestamp, submittedBy, headerComment, answers } = payload;

  const formattedDate = (() => {
    try { return new Date(timestamp).toLocaleString(); } catch { return timestamp; }
  })();

  const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const valueLabel = (v) =>
    v === 'yes' ? '<span style="color:#2e7d32;font-weight:700">YES</span>'
    : v === 'no' ? '<span style="color:#c62828;font-weight:700">NO</span>'
    : '—';

  const categories = groupAnswersByCategory(answers);

  const categoryTables = Array.from(categories.entries()).map(([cat, items]) => {
    const rows = items.map((a) => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #ddd;font-size:13px">${esc(a.questionLabel)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;white-space:nowrap">${valueLabel(a.value)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;color:#555">${a.comment ? esc(a.comment) : '<em style="color:#aaa">—</em>'}</td>
      </tr>`).join('');

    return `
      <h3 style="font-size:14px;margin:20px 0 8px;color:#1565c0;border-bottom:2px solid #1565c0;padding-bottom:4px">
        ${esc(cat)}
      </h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
        <thead>
          <tr style="background:#e3f2fd">
            <th style="padding:7px 10px;border:1px solid #ddd;text-align:left;font-size:12px;width:55%">Check Item</th>
            <th style="padding:7px 10px;border:1px solid #ddd;text-align:center;font-size:12px;width:15%">Status</th>
            <th style="padding:7px 10px;border:1px solid #ddd;text-align:left;font-size:12px;width:30%">Comment</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>MS Daily Health Check — Verification Status Report</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;margin:0;padding:20px;background:#f5f5f5">
  <div style="max-width:800px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:6px;overflow:hidden">

    <!-- Header banner -->
    <div style="background:#1565c0;padding:16px 24px">
      <h1 style="margin:0;color:#fff;font-size:18px">MS Daily Health Check — Verification Status Report</h1>
    </div>

    <div style="padding:24px">

      <!-- Metadata -->
      <table style="font-size:13px;margin-bottom:16px;color:#333">
        <tr><td style="padding:2px 16px 2px 0;font-weight:700;white-space:nowrap">Report ID</td><td>${esc(reportId)}</td></tr>
        <tr><td style="padding:2px 16px 2px 0;font-weight:700;white-space:nowrap">Generated</td><td>${esc(formattedDate)}</td></tr>
        <tr><td style="padding:2px 16px 2px 0;font-weight:700;white-space:nowrap">Submitted By</td><td>${esc(submittedBy)}</td></tr>
      </table>

      ${headerComment ? `
      <!-- Overall notes -->
      <div style="background:#f8f9fa;border-left:4px solid #1565c0;padding:12px 16px;margin-bottom:20px;border-radius:2px">
        <strong style="font-size:13px">Overall Notes</strong>
        <p style="margin:6px 0 0;font-size:13px;color:#444">${esc(headerComment).replace(/\n/g, '<br>')}</p>
      </div>` : ''}

      <!-- Verification tables -->
      ${categoryTables}

    </div>

    <!-- Footer -->
    <div style="background:#f5f5f5;padding:10px 24px;font-size:11px;color:#888;border-top:1px solid #ddd">
      Generated by Batch Monitoring Dashboard &bull; ${esc(formattedDate)}
    </div>
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
 * POST /api/status-report/email
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function sendEmailReport(req, res) {
  const payload = validatePayload(req.body);

  const transporter = getTransporter();

  if (!transporter) {
    // No SMTP configured — log the payload and return success so the UI works
    // in environments without email (dev, CI, staging without SMTP credentials).
    console.log(
      `[email-report] SMTP not configured — logging payload for report ${payload.reportId}:\n` +
      `  Submitted by: ${payload.submittedBy}\n` +
      `  Timestamp:    ${payload.timestamp}\n` +
      `  Answers:      ${payload.answers.length} question(s)\n` +
      `  Header note:  ${payload.headerComment || '(none)'}`
    );
    return res.status(200).json({
      success: true,
      message: 'Email report logged (SMTP not configured).',
      emailId: `LOG-${payload.reportId}`,
    });
  }

  const htmlBody  = buildEmailHtml(payload);
  const toList    = process.env.EMAIL_REPORT_TO || process.env.SMTP_FROM || '';
  const fromAddr  = process.env.SMTP_FROM || 'Batch Dashboard <no-reply@dashboard.local>';
  const subject   = `[Health Check] Verification Status Report — ${new Date(payload.timestamp).toLocaleDateString()}`;

  const info = await transporter.sendMail({
    from:    fromAddr,
    to:      toList,
    subject,
    html:    htmlBody,
  });

  console.log(`[email-report] Email dispatched. Message ID: ${info.messageId}`);

  return res.status(200).json({
    success: true,
    message: 'Verification status report emailed successfully.',
    emailId: info.messageId,
  });
}

module.exports = { sendEmailReport };
