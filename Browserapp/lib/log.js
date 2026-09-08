'use strict';

/**
 * OpenBrowser structured logger.
 *
 * Goals:
 *   - Single import path: `const { log } = require('./lib/log');`
 *   - Module-tagged child loggers: `log.child('automation')`, `log.child('mcp')`.
 *   - Five levels: trace, debug, info, warn, error.
 *   - Dev mode (NODE_ENV !== 'production'): pretty-printed to console + file.
 *   - Production mode: JSON-lines to rolling log file only.
 *   - Sensitive-field redaction: apiKey, token, password, cookie, secret, authorization
 *     auto-replaced with '[REDACTED]' before serialization.
 *   - Writes to Electron's app.getPath('logs') under openbrowser/<tag>.log.
 *
 * Usage:
 *   const { log } = require('./lib/log');
 *   log.info('profile started', { profileId: 'p1' });
 *   const mcpLog = log.child('mcp');
 *   mcpLog.warn('tool denied', { tool: 'rpa_run_steps' });
 *
 * NOT a security boundary — output is best-effort redaction. Source values
 * still exist in memory; callers should not pass raw secrets in the first place.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

const LEVELS = Object.freeze({
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  silent: 100,
});

const SENSITIVE_KEY_RE =
  /^(api[_-]?key|token|password|passwd|secret|cookie|authorization|x-api-key|access[_-]?token|refresh[_-]?token|client[_-]?secret)$/i;
const SENSITIVE_SUBSTR_RE = /(api[_-]?key|password|secret|authorization)\s*[:=]\s*[^\s,;}"\']+/gi;

/** Mask a string value when its key indicates a credential. */
function redactString(key, value) {
  if (typeof value !== 'string') return value;
  if (SENSITIVE_KEY_RE.test(String(key || ''))) {
    if (value.length === 0) return value;
    if (value.length <= 4) return '[REDACTED]';
    return `${value.slice(0, 2)}***[REDACTED:${value.length}]`;
  }
  // Generic in-string detection (e.g. "password=hunter2")
  return value.replace(SENSITIVE_SUBSTR_RE, (match, prefix) => {
    return `${prefix}=[REDACTED]`;
  });
}

/**
 * Recursively clone and redact an object/array.
 * Returns a new object; input is not mutated.
 *
 * Cycle safety: a per-call WeakSet tracks visited object references so that
 * circular structures (e.g. obj.self = obj) terminate with '[circular]'.
 * Depth limit is a separate guard against adversarial input.
 */
function redact(value, depth = 0, seen = new WeakSet()) {
  if (depth > 8) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') return value; // key-less strings are not auto-redacted
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString('message', value.message || ''),
      stack: value.stack,
      code: value.code,
    };
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1, seen));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redact(item, depth + 1, seen);
      }
    }
    return out;
  }
  return value;
}

/** ANSI color helpers for pretty output in dev. */
const COLOR = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};
function colorFor(level) {
  if (level === 'error') return COLOR.red;
  if (level === 'warn') return COLOR.yellow;
  if (level === 'info') return COLOR.cyan;
  if (level === 'debug') return COLOR.blue;
  return COLOR.gray;
}

function timestamp() {
  return new Date().toISOString();
}

/**
 * @typedef {Object} Logger
 * @property {(msg: string, meta?: object) => void} trace
 * @property {(msg: string, meta?: object) => void} debug
 * @property {(msg: string, meta?: object) => void} info
 * @property {(msg: string, meta?: object) => void} warn
 * @property {(msg: string, meta?: object) => void} error
 * @property {(tag: string) => Logger} child
 */

/**
 * Create a logger bound to a tag.
 * @param {string} tag - Module name (e.g. 'main', 'automation', 'mcp').
 * @returns {Logger}
 */
function createLogger(tag = 'openbrowser') {
  const writeToConsole = process.env.NODE_ENV !== 'production' && process.env.OPENBROWSER_LOG_SILENT !== '1';
  const filePath = resolveLogFilePath(tag);

  const log = (level, msg, meta) => {
    if (LEVELS[level] < (LEVELS[process.env.OPENBROWSER_LOG_LEVEL || 'debug'] || LEVELS.debug)) {
      return;
    }
    const entry = {
      ts: timestamp(),
      level,
      tag,
      msg: String(msg || ''),
      ...(meta && typeof meta === 'object' ? redact(meta) : {}),
    };
    const line = JSON.stringify(entry) + '\n';

    if (writeToConsole) {
      const c = colorFor(level);
      process.stderr.write(`${c}[${entry.ts}] ${level.toUpperCase()} ${tag} ${entry.msg}${COLOR.reset}\n`);
      if (meta && Object.keys(meta).length) {
        process.stderr.write(`${COLOR.gray}${JSON.stringify(redact(meta), null, 2)}${COLOR.reset}\n`);
      }
    }

    // File write is async-best-effort. Use synchronous append in dev for crash visibility;
    // async in production. Errors are silently swallowed to avoid log loops.
    try {
      if (writeToConsole) {
        fs.appendFileSync(filePath, line);
      } else {
        fsp.appendFile(filePath, line).catch(() => {});
      }
    } catch (_) {
      /* log failure is not actionable */
    }
  };

  return {
    trace: (msg, meta) => log('trace', msg, meta),
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    child: (subtag) => createLogger(`${tag}:${subtag}`),
  };
}

/**
 * Resolve the absolute path for the log file of a given tag.
 * Tries Electron's app.getPath('logs') first; falls back to OS-specific user data dir.
 */
function resolveLogFilePath(tag) {
  // Try Electron's app.getPath('logs') if available
  try {
    const electron = require('electron');
    if (electron?.app?.getPath) {
      const logsRoot = electron.app.getPath('logs');
      const file = path.join(logsRoot, 'openbrowser', `${tag}.log`);
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        return file;
      } catch (_) {
        /* fall through to non-electron path */
      }
    }
  } catch (_) {
    /* electron not available (e.g. tests) */
  }

  // Non-electron fallback: <tmp>/openbrowser-logs/<tag>.log
  const fallback = path.join(os.tmpdir(), 'openbrowser-logs', `${tag}.log`);
  try {
    fs.mkdirSync(path.dirname(fallback), { recursive: true });
  } catch (_) {
    /* noop */
  }
  return fallback;
}

/** Default root logger. Use child() to scope per module. */
const log = createLogger('main');

module.exports = {
  log,
  createLogger,
  redact,
  redactString,
  LEVELS,
};
