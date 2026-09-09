'use strict';

// Pure helpers extracted from Browserapp/renderer.js (Phase 3 REFAC-renderer-utils).
// Window-safe: NO use of `document`, `window`, `globalThis`, or any DOM API inside this file.
// Must work in both Node (for unit tests) and browser context (when loaded as a
// regular <script> tag in index.html).

const FORMAT_BYTES_KB_LIMIT = 1024 * 1024;

/**
 * Format a byte count as a short human-readable string.
 * Values < 1 MB render in KB (rounded, min 1 KB); larger values render in MB
 * with 1 decimal place. Non-numeric input is coerced to 0.
 *
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < FORMAT_BYTES_KB_LIMIT) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Generate a short opaque group id. Combines base36 randomness with a time-based
 * suffix. Not cryptographically strong — just unique enough for UI grouping.
 *
 * @returns {string}
 */
function createGroupId() {
  return 'grp-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * Coerce a value to a positive integer. Returns 0 for anything that cannot
 * be parsed as an integer > 0 (including 0, negatives, NaN, non-numeric
 * strings, null, undefined).
 *
 * @param {*} value
 * @returns {number}
 */
function positiveProfileNumber(value) {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

/**
 * UMD-lite: expose via CommonJS (Node tests) and via a global property
 * (when loaded as a plain <script> in the browser).
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatBytes, createGroupId, positiveProfileNumber };
}
if (typeof window !== 'undefined') {
  window.__rendererUtils = { formatBytes, createGroupId, positiveProfileNumber };
}
