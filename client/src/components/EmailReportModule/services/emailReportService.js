/**
 * emailReportService.js — API client for the Email Status Report dispatch endpoint.
 *
 * Single responsibility: construct and send the POST /api/status-report/email
 * request.  All components interact with the backend through this function —
 * never call axios directly from a component.
 *
 * Security:
 *   - Payload is sent over HTTPS (enforced by the host server TLS config).
 *   - No credentials are embedded in the payload — the server resolves the
 *     sending email address from its own environment configuration.
 *   - Input sanitisation (trim, length) is performed in useVerificationForm
 *     before this service is invoked.
 */

import axios from 'axios';
import { API_PATHS } from '../../../utils/constants';

/** Dedicated axios instance — 30 s timeout for the email dispatch call. */
const emailClient = axios.create({
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Normalise error messages from the server envelope.
emailClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'Email dispatch failed. Please try again.';
    return Promise.reject(new Error(message));
  }
);

/**
 * Builds a stable, URL-safe report ID from the current timestamp.
 * Format: SR-<YYYYMMDD>-<HHmmss>-<4-digit-millis>
 *
 * Not cryptographically random — used only as a human-readable tracking token.
 *
 * @returns {string}
 */
export function generateReportId() {
  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, '0');
  const pad4 = (n) => String(n).padStart(4, '0');
  const date =
    `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const time =
    `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `SR-${date}-${time}-${pad4(now.getMilliseconds())}`;
}

/**
 * Fetches automated DB check values and environment email configuration from the backend.
 *
 * @returns {Promise<{ success: boolean, autoChecks: Object, emailConfig: Object }>}
 */
export async function fetchAutoChecks() {
  const res = await emailClient.get(API_PATHS.statusReportEmailAutoChecks());
  return res.data;
}

/**
 * Fetches the rendered email HTML preview and metadata from the backend.
 *
 * @param {import('../types/emailReport.types').EmailReportPayload} payload
 * @returns {Promise<{ success: boolean, html: string, emailConfig: Object }>}
 */
export async function fetchEmailPreview(payload) {
  const res = await emailClient.post(API_PATHS.statusReportEmailPreview(), payload);
  return res.data;
}

/**
 * Dispatches the email status report to the backend.
 *
 * @param {import('../types/emailReport.types').EmailReportPayload} payload
 * @returns {Promise<import('../types/emailReport.types').EmailDispatchResponse>}
 * @throws {Error} When the server returns a non-2xx response or the request times out.
 */
export async function dispatchEmailReport(payload) {
  const res = await emailClient.post(API_PATHS.statusReportEmail(), payload);
  return res.data;
}
