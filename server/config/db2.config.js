/**
 * db2.config.js — DB2 connection configuration.
 *
 * All values are sourced from environment variables so credentials are never
 * hardcoded. Update the env vars (or .env file) to change the target database
 * without touching this file.
 *
 * Environment variables:
 *   DB2_HOST      — DB2 server hostname or IP
 *   DB2_PORT      — DB2 server port (default: 50000)
 *   DB2_DATABASE  — Database name
 *   DB2_USER      — DB2 username
 *   DB2_PASSWORD  — DB2 password
 *   DB2_SCHEMA    — Default schema (default: db2prd1)
 *
 * Connection string format used by ibm_db:
 *   "DATABASE=<db>;HOSTNAME=<host>;PORT=<port>;PROTOCOL=TCPIP;UID=<user>;PWD=<pass>;"
 */

'use strict';

/**
 * Returns the ibm_db connection string built from environment variables.
 * Throws a descriptive error at startup if any required variable is missing.
 *
 * @returns {string} IBM DB2 connection string
 */
function getDb2ConnectionString() {
  const required = ['DB2_HOST', 'DB2_DATABASE', 'DB2_USER', 'DB2_PASSWORD'];
  const missing  = required.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    throw new Error(
      `DB2 configuration is incomplete. Missing environment variables: ${missing.join(', ')}. ` +
      'Set these in your .env file before using the Status Report feature.'
    );
  }

  const host     = process.env.DB2_HOST;
  const port     = process.env.DB2_PORT     || '50000';
  const database = process.env.DB2_DATABASE;
  const user     = process.env.DB2_USER;
  const password = process.env.DB2_PASSWORD;
  const schema   = process.env.DB2_SCHEMA   || 'db2prd1';

  return (
    `DATABASE=${database};` +
    `HOSTNAME=${host};` +
    `PORT=${port};` +
    `PROTOCOL=TCPIP;` +
    `UID=${user};` +
    `PWD=${password};` +
    `CurrentSchema=${schema};`
  );
}

module.exports = { getDb2ConnectionString };
