/**
 * sshService.js — fetches a remote log file via SSH.
 *
 * Uses the `ssh2` package to open a single-use connection, execute a
 * `tail` command on the remote path, and return the captured output as
 * a string.  Credentials are read exclusively from environment variables
 * so they are never visible to browser clients.
 *
 * Required .env variables:
 *   LOG_SSH_HOST      — hostname / IP of the batch server
 *   LOG_SSH_USER      — SSH username
 *   LOG_SSH_PASSWORD  — SSH password
 *
 * Optional .env variables:
 *   LOG_SSH_PORT      — SSH port (default: 22)
 *   LOG_FETCH_LINES   — number of tail lines to return (default: 500)
 *
 * Security notes:
 *   - The remote path is validated against an allowlist prefix before use
 *     to prevent path-traversal attacks.
 *   - readyTimeout is capped at 10 s to fail fast on unreachable hosts.
 */

'use strict';

const { Client } = require('ssh2');

// ── Configuration ─────────────────────────────────────────────────────────────

/** Known-safe root prefixes.  Requests whose logPath does not start with
 *  one of these are rejected before the SSH connection is even opened.
 *  Extend this list to match your server's actual log directory layout.
 */
const ALLOWED_LOG_PREFIXES = [
  '/opt/app/accessms/bin/',
  '/opt/logs/Batch/',
];

const DEFAULT_LINES  = 500;
const SSH_TIMEOUT_MS = 10_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the SSH connection config from environment variables.
 * Throws a 503-flagged Error when required variables are absent.
 *
 * @returns {{ host: string, port: number, username: string, password: string }}
 */
function getSshConfig() {
  const { LOG_SSH_HOST, LOG_SSH_USER, LOG_SSH_PASSWORD } = process.env;

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
    host:         LOG_SSH_HOST,
    port:         Number(process.env.LOG_SSH_PORT) || 22,
    username:     LOG_SSH_USER,
    password:     LOG_SSH_PASSWORD,
    readyTimeout: SSH_TIMEOUT_MS,
  };
}

/**
 * Validates that logPath starts with one of the ALLOWED_LOG_PREFIXES.
 * Throws a 400-flagged Error on failure to prevent path-traversal abuse.
 *
 * @param {string} logPath
 */
function validateLogPath(logPath) {
  const isAllowed = ALLOWED_LOG_PREFIXES.some((prefix) =>
    logPath.startsWith(prefix)
  );
  if (!isAllowed) {
    const err = new Error(
      `Log path "${logPath}" is outside the allowed directories. ` +
      `Allowed prefixes: ${ALLOWED_LOG_PREFIXES.join(', ')}`
    );
    err.status = 400;
    throw err;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Opens an SSH connection to the configured batch server, tails the last
 * `lines` lines from `logPath`, and returns the output as a string.
 *
 * @param {string} logPath   — Absolute path to the log file on the remote server
 * @param {number} [lines]   — Number of tail lines (default: LOG_FETCH_LINES || 500)
 * @returns {Promise<string>} — Captured stdout from the tail command
 * @throws {Error}             On invalid path, missing config, or SSH failure
 */
function fetchRemoteLog(logPath, lines) {
  validateLogPath(logPath);

  const tailLines = lines ?? (Number(process.env.LOG_FETCH_LINES) || DEFAULT_LINES);
  const config    = getSshConfig();

  // Escape the path: replace single-quotes to prevent command injection.
  const safePath  = logPath.replace(/'/g, "'\\''");
  const command   = `tail -n ${tailLines} '${safePath}'`;

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
                const msg = stderr.trim() || `Remote command exited with code ${code}`;
                const e   = new Error(msg);
                e.status  = 404;
                return reject(e);
              }
              resolve(output);
            })
            .on('data', (chunk) => { output += chunk; })
            .stderr.on('data', (chunk) => { stderr += chunk; });
        });
      })
      .on('error', (err) => reject(err))
      .connect(config);
  });
}

module.exports = { fetchRemoteLog };
