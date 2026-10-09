/**
 * runCommandController.js — executes a batch run or resume command via SSH.
 *
 * POST /api/batch/run-command
 *
 * Request body:
 *   { command: string, commandType: 'run' | 'resume' }
 *
 * Response (always JSON):
 *   { success: true,  output: string, exitCode: number }           — success
 *   { success: false, error: string, output: string, exitCode: number } — failure
 *
 * Feature gate:
 *   ENABLE_SSH_RUN_COMMAND must be "true" in .env; otherwise the endpoint
 *   returns 403 immediately without opening any SSH connection.
 *
 * Security:
 *   - Command string is validated against an allowlist pattern before execution.
 *     Only strings matching `sudo ./qclient.sh (runJobOnly|resumeJob) …` with
 *     safe characters are accepted — any other input is rejected with 400.
 *   - SSH credentials come exclusively from environment variables (no hardcoding).
 *   - The SSH connection is always closed after execution (success or failure).
 *   - A 60-second execution timeout prevents hung sessions.
 */

'use strict';

const { Client } = require('ssh2');

const SSH_TIMEOUT_MS = 10_000;   // connection ready timeout
const EXEC_TIMEOUT_MS = 60_000;  // maximum command execution time

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns SSH connection config from the same environment variables used by
 * sshService.js (LOG_SSH_HOST / LOG_SSH_USER / LOG_SSH_PASSWORD / LOG_SSH_PORT).
 * Throws a 503-flagged Error when required variables are absent.
 * @returns {{ host, port, username, password, readyTimeout }}
 */
function getSshConfig() {
  const missing = ['LOG_SSH_HOST', 'LOG_SSH_USER', 'LOG_SSH_PASSWORD'].filter(
    (k) => !process.env[k]
  );
  if (missing.length > 0) {
    const err = new Error(
      `SSH is not configured. Missing .env variable(s): ${missing.join(', ')}`
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
 * Validates that `command` matches the expected qclient.sh invocation pattern.
 *
 * Accepted pattern (mirrors buildQclientLine in client/src/utils/constants.js):
 *   sudo ./qclient.sh (runJobOnly|resumeJob) <batchName> <scheduleName> ["<args>"]
 *
 * All tokens must contain only: word chars, hyphens, dots, forward slashes,
 * equals signs, hashes, spaces, and quoted argument blocks.
 * Throws a 400-flagged Error on mismatch (shell-injection guard).
 *
 * @param {string} command
 */
function validateCommand(command) {
  // Must start with the expected prefix
  if (!command.startsWith('sudo ./qclient.sh ')) {
    const err = new Error('Command must start with "sudo ./qclient.sh".');
    err.status = 400;
    throw err;
  }
  // Only safe characters allowed in the full command string:
  // word chars, hyphens, dots, forward slashes, equals, hashes, spaces,
  // double quotes (for quoted argument block), and at-sign.
  if (!/^[\w\s./\-=\#"@]+$/.test(command)) {
    const err = new Error(
      'Command contains unsafe characters. Only alphanumeric characters, ' +
      'hyphens, dots, slashes, equals, hashes, spaces, and double quotes are allowed.'
    );
    err.status = 400;
    throw err;
  }
  // The action token must be one of the two known values
  const actionMatch = command.match(/^sudo \.\/qclient\.sh (\S+)/);
  if (!actionMatch || !['runJobOnly', 'resumeJob'].includes(actionMatch[1])) {
    const err = new Error('Command action must be "runJobOnly" or "resumeJob".');
    err.status = 400;
    throw err;
  }
}

/**
 * Opens a single-use SSH connection, runs `command`, and resolves with
 * { output, exitCode }.  The connection is always closed on completion.
 *
 * @param {string} command
 * @returns {Promise<{ output: string, exitCode: number }>}
 */
function runSshCommand(command) {
  const config = getSshConfig();

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = '';
    let stderr = '';
    let execTimer;

    conn
      .on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }

          // Hard timeout — kill the stream if the command hangs
          execTimer = setTimeout(() => {
            stream.destroy();
            conn.end();
            const e = new Error(
              `Command execution timed out after ${EXEC_TIMEOUT_MS / 1000}s.`
            );
            e.status = 504;
            reject(e);
          }, EXEC_TIMEOUT_MS);

          stream
            .on('close', (code) => {
              clearTimeout(execTimer);
              conn.end();
              resolve({ output: (stdout + (stderr ? `\nSTDERR:\n${stderr}` : '')).trim(), exitCode: code ?? 0 });
            })
            .on('data',  (chunk) => { stdout += chunk; })
            .stderr.on('data', (chunk) => { stderr += chunk; });
        });
      })
      .on('error', (err) => {
        clearTimeout(execTimer);
        reject(err);
      })
      .connect(config);
  });
}

// ── Controller ────────────────────────────────────────────────────────────────

/**
 * POST /api/batch/run-command
 */
async function runCommand(req, res) {
  // Feature gate
  if (process.env.ENABLE_SSH_RUN_COMMAND !== 'true') {
    return res.status(403).json({
      success:  false,
      error:    'SSH run command feature is disabled. Set ENABLE_SSH_RUN_COMMAND=true in .env to enable it.',
      output:   '',
      exitCode: -1,
    });
  }

  const { command, commandType } = req.body;

  // Basic presence checks
  if (!command || typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({
      success:  false,
      error:    'Request body must include a non-empty "command" string.',
      output:   '',
      exitCode: -1,
    });
  }
  if (!['run', 'resume'].includes(commandType)) {
    return res.status(400).json({
      success:  false,
      error:    '"commandType" must be "run" or "resume".',
      output:   '',
      exitCode: -1,
    });
  }

  // Sanitise / validate the command string (throws 400 on violation)
  validateCommand(command.trim());

  try {
    const { output, exitCode } = await runSshCommand(command.trim());

    if (exitCode !== 0) {
      return res.status(200).json({
        success:  false,
        error:    `Command exited with code ${exitCode}.`,
        output,
        exitCode,
      });
    }

    return res.status(200).json({
      success:  true,
      output:   output || '(no output)',
      exitCode,
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success:  false,
      error:    err.message || 'SSH execution failed.',
      output:   '',
      exitCode: -1,
    });
  }
}

module.exports = { runCommand };
