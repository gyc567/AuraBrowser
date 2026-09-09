'use strict';

// Browser startup diagnostic helpers, extracted from Browserapp/engine.js (Phase 2 REFAC-engine-diagnostic).
// Pure functions over Buffer/string/Error; one async helper that writes a bounded ring log.
// No state, no IPC, no Electron API. Safe to unit-test in isolation.

const fsp = require('fs/promises');
const path = require('path');

const STARTUP_DIAGNOSTIC_LIMIT = 16 * 1024;
const STARTUP_LOG_TRIGGER_BYTES = 512 * 1024;
const STARTUP_LOG_KEEP_BYTES = 256 * 1024;

/**
 * Append a chunk to a bounded diagnostic buffer, keeping only the last
 * STARTUP_DIAGNOSTIC_LIMIT characters. Accepts Buffer or string chunks.
 *
 * @param {string|Buffer|null|undefined} current
 * @param {string|Buffer|null|undefined} chunk
 * @returns {string}
 */
function appendDiagnosticOutput(current, chunk) {
  const value = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '');
  return (String(current || '') + value).slice(-STARTUP_DIAGNOSTIC_LIMIT);
}

/**
 * Build a single-line error message that includes diagnostic context:
 *   "<error message> [executable=...; profile=...; pid=...; exitCode=...; signal=...; browserOutput=...]"
 * Idempotent: if the base already contains "[executable=", returns it unchanged.
 *
 * @param {Error|string} error
 * @param {{pid?:number,exitCode?:number,signalCode?:string}|null|undefined} child
 * @param {{launchBinary?:string,profileRoot?:string,stderr?:string,stdout?:string}} [diagnostic]
 * @returns {string}
 */
function formatBrowserStartupError(error, child, diagnostic = {}) {
  const base = String((error && error.message) || error || 'Browser startup failed').trim();
  if (base.includes('[executable=')) return base;
  const details = [];
  if (diagnostic.launchBinary) details.push(`executable=${diagnostic.launchBinary}`);
  if (diagnostic.profileRoot) details.push(`profile=${diagnostic.profileRoot}`);
  if (child && child.pid) details.push(`pid=${child.pid}`);
  if (child && child.exitCode !== null && child.exitCode !== undefined) {
    details.push(`exitCode=${child.exitCode}`);
  }
  if (child && child.signalCode) details.push(`signal=${child.signalCode}`);
  const output = [diagnostic.stderr, diagnostic.stdout]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (output.length) details.push(`browserOutput=${output.join(' | ')}`);
  return details.length ? `${base} [${details.join('; ')}]` : base;
}

/**
 * Append a JSON line to <userDataPath>/logs/browser-startup.log and rotate
 * the file when it grows past STARTUP_LOG_TRIGGER_BYTES (keeping the last
 * STARTUP_LOG_KEEP_BYTES). Best-effort: errors are swallowed.
 *
 * @param {string} userDataPath
 * @param {object} record
 * @returns {Promise<void>}
 */
async function writeBrowserStartupDiagnostic(userDataPath, record) {
  try {
    const logDir = path.join(userDataPath, 'logs');
    await fsp.mkdir(logDir, { recursive: true });
    const file = path.join(logDir, 'browser-startup.log');
    const line = JSON.stringify({ at: new Date().toISOString(), ...record }) + '\n';
    await fsp.appendFile(file, line, 'utf8');
    const stat = await fsp.stat(file);
    if (stat.size > STARTUP_LOG_TRIGGER_BYTES) {
      const content = await fsp.readFile(file, 'utf8');
      await fsp.writeFile(file, content.slice(-STARTUP_LOG_KEEP_BYTES), 'utf8');
    }
  } catch (_) {
    // best-effort; do not throw
  }
}

module.exports = {
  STARTUP_DIAGNOSTIC_LIMIT,
  STARTUP_LOG_TRIGGER_BYTES,
  STARTUP_LOG_KEEP_BYTES,
  appendDiagnosticOutput,
  formatBrowserStartupError,
  writeBrowserStartupDiagnostic,
};
