/**
 * sshService.js — fetches remote batch log files via SSH.
 *
 * File naming conventions on the remote server (from observed directory structure):
 *
 *   Daily log   : <logDir>/<BatchName><MM-DD-YYYY>.log
 *                 e.g. BatchGetDd214Response10-06-2026.log
 *
 *   Error log   : <logDir>/*<BatchName>*_Bus_Error.log
 *                 e.g. benefits_icon_import_12pm_BatchGetDd214Response_Bus_Error.log
 *                 (NOT _Bus_Error_Internal.log)
 *
 * Two public functions:
 *   fetchTodayLog(logDir, batchName, lines)  — today's dated log file
 *   fetchErrorLog(logDir, batchName, lines)  — *BatchName*_Bus_Error.log (not Internal)
 *
 * Required .env variables:
 *   LOG_SSH_HOST      — hostname / IP of the batch server
 *   LOG_SSH_USER      — SSH username
 *   LOG_SSH_PASSWORD  — SSH password
 *
 * Optional .env variables:
 *   LOG_SSH_PORT    — SSH port (default: 22)
 *   LOG_FETCH_LINES — number of tail lines to return (default: 500)
 *
 * Security:
 *   - logDir is validated against ALLOWED_LOG_PREFIXES before any SSH connection
 *     is opened (prevents path-traversal).
 *   - batchName is validated to contain only word characters, hyphens, and dots
 *     (prevents shell injection via the batch name).
 *   - All path components are single-quoted in the shell command.
 */

'use strict';

const { Client } = require('ssh2');

// ── Configuration ─────────────────────────────────────────────────────────────

const ALLOWED_LOG_PREFIXES = [
  '/opt/app/accessms/bin/',
  '/opt/logs/Batch/',
];

const DEFAULT_LINES  = 500;
const SSH_TIMEOUT_MS = 10_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds today's date string in MM-DD-YYYY format (matches server file naming).
 * @returns {string}  e.g. "10-06-2026"
 */
function todayMMDDYYYY() {
  const d   = new Date();
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const dd  = String(d.getDate()).padStart(2, '0');
  const yy  = d.getFullYear();
  return `${mm}-${dd}-${yy}`;
}

/**
 * Returns SSH connection config from environment variables.
 * Throws a 503-flagged Error when required variables are absent.
 * @returns {{ host, port, username, password, readyTimeout }}
 */
function getSshConfig() {
  const missing = ['LOG_SSH_HOST', 'LOG_SSH_USER', 'LOG_SSH_PASSWORD'].filter(
    (k) => !process.env[k]
  );
  if (missing.length > 0) {
    const err = new Error(
      `SSH log fetch is not configured. Missing .env variable(s): ${missing.join(', ')}`
    );
    err.status = 503;
    throw err;
  }
  return {
    host:         process.env.LOG_SSH_HOST,
    port:         Number(process.env.LOG_SSH_PORT) || 22,
    username:     process.env.LOG_SSH_USER,
    password:     process.env.LOG_SSH_PASSWORD,
    readyTimeout: SSH_TIMEOUT_MS,
  };
}

/**
 * Validates logDir is inside an allowed prefix.
 * Throws a 400-flagged Error on failure (path-traversal guard).
 * @param {string} logDir
 */
function validateLogDir(logDir) {
  const allowed = ALLOWED_LOG_PREFIXES.some((p) => logDir.startsWith(p));
  if (!allowed) {
    const err = new Error(
      `Log directory "${logDir}" is outside the allowed directories. ` +
      `Allowed prefixes: ${ALLOWED_LOG_PREFIXES.join(', ')}`
    );
    err.status = 400;
    throw err;
  }
}

/**
 * Validates batchName contains only safe characters (word chars, hyphens, dots).
 * Throws a 400-flagged Error on any other character (shell-injection guard).
 * @param {string} batchName
 */
function validateBatchName(batchName) {
  if (!/^[\w.\-]+$/.test(batchName)) {
    const err = new Error(`Invalid batch name "${batchName}": contains unsafe characters.`);
    err.status = 400;
    throw err;
  }
}

/**
 * Core SSH executor — opens a single-use connection, runs `command`,
 * collects stdout, resolves with the captured text.
 *
 * @param {string} command  — Shell command to run on the remote server
 * @param {string} notFoundMsg — Human-readable message used when the command
 *                               exits non-zero with no stdout (file not found, etc.)
 * @returns {Promise<string>}
 */
function runSshCommand(command, notFoundMsg) {
  const config = getSshConfig();

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    let stderr = '';

    conn
      .on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          stream
            .on('close', (code) => {
              conn.end();
              if (code !== 0 && output === '') {
                const msg = stderr.trim() || notFoundMsg;
                const e   = new Error(msg);
                e.status  = 404;
                return reject(e);
              }
              resolve(output);
            })
            .on('data',  (chunk) => { output += chunk; })
            .stderr.on('data', (chunk) => { stderr += chunk; });
        });
      })
      .on('error', (err) => reject(err))
      .connect(config);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches today's dated log file for a batch.
 *
 * Resolves the file as:
 *   <logDir>/<BatchName><MM-DD-YYYY>.log
 *   e.g. /opt/app/accessms/bin/benefits/batch/logs/BatchGetDd214Response/BatchGetDd214Response10-06-2026.log
 *
 * @param {string} logDir    — Full path to the batch log directory on the remote server
 * @param {string} batchName — Batch name (used to construct the filename)
 * @param {number} [lines]   — Tail depth (default: LOG_FETCH_LINES env or 500)
 * @returns {Promise<string>}
 */
function fetchTodayLog(logDir, batchName, lines) {
  validateLogDir(logDir);
  validateBatchName(batchName);

  const tailLines = lines ?? (Number(process.env.LOG_FETCH_LINES) || DEFAULT_LINES);
  const fileName  = `${batchName}${todayMMDDYYYY()}.log`;
  // Normalise logDir — strip trailing slash so path join is clean
  const dir       = logDir.replace(/\/+$/, '');
  const filePath  = `${dir}/${fileName}`;

  const safeFile  = filePath.replace(/'/g, "'\\''");
  const command   = `tail -n ${tailLines} '${safeFile}'`;

  return runSshCommand(
    command,
    `Today's log file not found: ${fileName} — the batch may not have run today.`
  );
}

/**
 * Fetches the Bus Error log for a batch.
 *
 * Pattern:  *<BatchName>*_Bus_Error.log  (excludes _Bus_Error_Internal.log)
 *
 * Uses `ls -t` to find the matching file, then tails it.
 * If multiple files match (unlikely but possible), the most recently
 * modified one is used.
 *
 * @param {string} logDir    — Full path to the batch log directory on the remote server
 * @param {string} batchName — Batch name
 * @param {number} [lines]   — Tail depth (default: LOG_FETCH_LINES env or 500)
 * @returns {Promise<string>}
 */
function fetchErrorLog(logDir, batchName, lines) {
  validateLogDir(logDir);
  validateBatchName(batchName);

  const tailLines = lines ?? (Number(process.env.LOG_FETCH_LINES) || DEFAULT_LINES);
  const dir       = logDir.replace(/\/+$/, '');

  // Shell one-liner:
  //   1. ls -t  — list files newest-first
  //   2. grep   — keep only *BatchName*_Bus_Error.log, exclude _Internal
  //   3. head -1 — take the newest match
  //   4. xargs tail -n N — tail it
  // Single-quote batchName is already validated to be word/hyphen/dot only.
  const safeDir  = dir.replace(/'/g, "'\\''");
  const command  =
    `ls -t '${safeDir}' | grep -E '${batchName}_Bus_Error\\.log$' | grep -v '_Internal' | head -1 | xargs -I{} tail -n ${tailLines} '${safeDir}/{}'`;

  return runSshCommand(
    command,
    `Error log not found: no file matching *${batchName}*_Bus_Error.log in ${dir}`
  );
}

module.exports = { fetchTodayLog, fetchErrorLog };
