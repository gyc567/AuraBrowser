'use strict';

// Browser proxy helpers, extracted from Browserapp/engine.js (Phase 2 REFAC-engine-proxy).
// Pure functions over a proxy URL string. No state, no IPC, no Electron API.
// parseProxy is re-exported from proxy-forwarder (single source of truth).

const { parseProxy } = require('../proxy-forwarder');

/**
 * Safely parse a proxy URL string. Returns the parsed object on success or null on error.
 * Trims surrounding whitespace and tolerates null/undefined input.
 *
 * @param {string|null|undefined} value
 * @returns {object|null}
 */
function parsedProxy(value) {
  try {
    return parseProxy(String(value || '').trim());
  } catch (_) {
    return null;
  }
}

/**
 * Whether a proxy URL has credentials (user/password) embedded.
 * Used to gate proxy credential leakage in logs and IPC.
 *
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
function proxyHasCredentials(value) {
  return Boolean(parsedProxy(value) && parsedProxy(value).authenticated);
}

/**
 * Compare two proxy URLs by protocol/host/port (ignoring credentials and path).
 * Returns false if either fails to parse.
 *
 * @param {string|null|undefined} left
 * @param {string|null|undefined} right
 * @returns {boolean}
 */
function sameProxyEndpoint(left, right) {
  const a = parsedProxy(left);
  const b = parsedProxy(right);
  return Boolean(a && b && a.protocol === b.protocol && a.host === b.host && a.port === b.port);
}

module.exports = {
  parsedProxy,
  proxyHasCredentials,
  sameProxyEndpoint,
};
