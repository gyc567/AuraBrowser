'use strict';

/**
 * OpenBrowser error hierarchy.
 *
 * Every error thrown by OpenBrowser should be an instance of `AppError` (or
 * a Node.js built-in like `TypeError`). This gives us:
 *   - Stable machine-readable `code` strings (e.g. 'PROFILE_LOCKED')
 *     for IPC, MCP, and Local API consumers.
 *   - `userMessage` (an i18n key) so the renderer can show localized text
 *     without parsing English error strings.
 *   - `retryable` flag for orchestrators (RPA / MCP) to decide whether to
 *     retry, abort, or surface to the user.
 *   - `cause` (ES2022 Error chaining) for the original lower-level error.
 *
 * Naming convention: SCREAMING_SNAKE_CASE module prefixes.
 *
 *   PROFILE_*        — engine/profile.js lifecycle
 *   KERNEL_*         — kernel boot / binary selection
 *   PROXY_*          — proxy configuration / connection
 *   FINGERPRINT_*    — fingerprint generation / injection
 *   ISOLATION_*      — profile lock / path safety (legacy aliases kept)
 *   RPA_*            — RPA plan / task execution
 *   LOCAL_API_*      — HTTP API server
 *   MCP_*            — MCP stdio protocol
 *   CLOUD_*          — cloud backup
 *   STORE_*          — persistent store
 *
 * Tests in tests/unit/errors.test.js. New error subclasses MUST add a test
 * that verifies `code`, `userMessage`, and `retryable`.
 */

class AppError extends Error {
  /**
   * @param {string} message - Human-readable English message (developer-facing).
   * @param {object} [options]
   * @param {string} [options.code] - Machine-readable code (e.g. 'PROFILE_LOCKED').
   * @param {string} [options.userMessage] - i18n key for user-facing message.
   * @param {boolean} [options.retryable=false] - Whether callers should retry.
   * @param {Error} [options.cause] - Original lower-level error (Node 16+).
   * @param {object} [options.context] - Structured metadata for logs.
   */
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    if (options.code) this.code = options.code;
    if (options.userMessage) this.userMessage = options.userMessage;
    if (typeof options.retryable === 'boolean') this.retryable = options.retryable;
    if (options.cause) this.cause = options.cause;
    if (options.context) this.context = options.context;
    // Capture stack trace excluding constructor frame (V8 only).
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize for IPC / API responses.
   * Drops stack trace (kept server-side), keeps code + message + context.
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code || null,
      message: this.message,
      userMessage: this.userMessage || null,
      retryable: this.retryable === true,
      cause: this.cause ? { name: this.cause.name, message: this.cause.message } : null,
      context: this.context || null,
    };
  }
}

// =================================================================
// Profile / lifecycle
// =================================================================

class ProfileLockedError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'PROFILE_LOCKED',
      userMessage: options.userMessage || 'error.profile.locked',
      retryable: false,
      ...options,
    });
  }
}

class ProfileLockUnrecoverableError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'PROFILE_LOCK_UNRECOVERABLE',
      userMessage: options.userMessage || 'error.profile.lockUnrecoverable',
      retryable: false,
      ...options,
    });
  }
}

class ProfileNotFoundError extends AppError {
  constructor(profileId, options = {}) {
    super(`Profile not found: ${profileId}`, {
      code: 'PROFILE_NOT_FOUND',
      userMessage: 'error.profile.notFound',
      retryable: false,
      context: { profileId },
      ...options,
    });
    this.profileId = profileId;
  }
}

class ProfileAlreadyExistsError extends AppError {
  constructor(profileId, options = {}) {
    super(`Profile already exists: ${profileId}`, {
      code: 'PROFILE_ALREADY_EXISTS',
      userMessage: 'error.profile.alreadyExists',
      retryable: false,
      context: { profileId },
      ...options,
    });
    this.profileId = profileId;
  }
}

class ProfileStartFailedError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'PROFILE_START_FAILED',
      userMessage: options.userMessage || 'error.profile.startFailed',
      retryable: options.retryable !== false, // default: retryable
      ...options,
    });
  }
}

class ProfileStopFailedError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: 'PROFILE_STOP_FAILED',
      userMessage: 'error.profile.stopFailed',
      retryable: false,
      ...options,
    });
  }
}

class InvalidProfileIdError extends AppError {
  constructor(profileId, reason = 'malformed', options = {}) {
    super(`Invalid profile id: ${profileId} (${reason})`, {
      code: 'INVALID_PROFILE_ID',
      userMessage: 'error.profile.invalidId',
      retryable: false,
      context: { profileId, reason },
      ...options,
    });
  }
}

// =================================================================
// Kernel / browser binary
// =================================================================

class KernelNotReadyError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'KERNEL_NOT_READY',
      userMessage: options.userMessage || 'error.kernel.notReady',
      retryable: true,
      ...options,
    });
  }
}

class KernelDownloadFailedError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: 'KERNEL_DOWNLOAD_FAILED',
      userMessage: 'error.kernel.downloadFailed',
      retryable: true,
      ...options,
    });
  }
}

class KernelStartupTimeoutError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: 'KERNEL_STARTUP_TIMEOUT',
      userMessage: 'error.kernel.startupTimeout',
      retryable: true,
      ...options,
    });
  }
}

// =================================================================
// Proxy
// =================================================================

class ProxyUnreachableError extends AppError {
  constructor(proxy, options = {}) {
    super(`Proxy unreachable: ${proxy}`, {
      code: 'PROXY_UNREACHABLE',
      userMessage: 'error.proxy.unreachable',
      retryable: true,
      context: { proxy: String(proxy || '').replace(/:[^:@/]+@/, ':***@') }, // redact password
      ...options,
    });
    this.proxy = proxy;
  }
}

class ProxyAuthFailedError extends AppError {
  constructor(proxy, options = {}) {
    super(`Proxy authentication failed: ${proxy}`, {
      code: 'PROXY_AUTH_FAILED',
      userMessage: 'error.proxy.authFailed',
      retryable: false,
      context: { proxy: String(proxy || '').replace(/:[^:@/]+@/, ':***@') },
      ...options,
    });
    this.proxy = proxy;
  }
}

class InvalidProxyError extends AppError {
  constructor(value, reason = '', options = {}) {
    super(`Invalid proxy: ${value}${reason ? ' (' + reason + ')' : ''}`, {
      code: 'INVALID_PROXY',
      userMessage: 'error.proxy.invalid',
      retryable: false,
      context: { value: String(value || ''), reason },
      ...options,
    });
  }
}

// =================================================================
// Fingerprint
// =================================================================

class FingerprintConflictError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: 'FINGERPRINT_CONFLICT',
      userMessage: 'error.fingerprint.conflict',
      retryable: false,
      ...options,
    });
  }
}

class FingerprintInjectionFailedError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: 'FINGERPRINT_INJECTION_FAILED',
      userMessage: 'error.fingerprint.injectFailed',
      retryable: true,
      ...options,
    });
  }
}

// =================================================================
// RPA
// =================================================================

class RpaPlanNotFoundError extends AppError {
  constructor(planId, options = {}) {
    super(`RPA plan not found: ${planId}`, {
      code: 'RPA_PLAN_NOT_FOUND',
      userMessage: 'error.rpa.planNotFound',
      retryable: false,
      context: { planId },
      ...options,
    });
  }
}

class RpaTaskNotFoundError extends AppError {
  constructor(taskId, options = {}) {
    super(`RPA task not found: ${taskId}`, {
      code: 'RPA_TASK_NOT_FOUND',
      userMessage: 'error.rpa.taskNotFound',
      retryable: false,
      context: { taskId },
      ...options,
    });
  }
}

class RpaStepFailedError extends AppError {
  constructor(stepType, message, options = {}) {
    super(`RPA step '${stepType}' failed: ${message}`, {
      code: 'RPA_STEP_FAILED',
      userMessage: 'error.rpa.stepFailed',
      retryable: options.retryable === true, // most steps are not auto-retryable
      context: { stepType },
      ...options,
    });
    this.stepType = stepType;
  }
}

class RpaTimeoutError extends AppError {
  constructor(operation, timeoutMs, options = {}) {
    super(`RPA ${operation} timed out after ${timeoutMs}ms`, {
      code: 'RPA_TIMEOUT',
      userMessage: 'error.rpa.timeout',
      retryable: true,
      context: { operation, timeoutMs },
      ...options,
    });
  }
}

// =================================================================
// Local API / MCP
// =================================================================

class LocalApiAuthError extends AppError {
  constructor(message = 'unauthorized', options = {}) {
    super(message, {
      code: 'LOCAL_API_UNAUTHORIZED',
      userMessage: 'error.api.unauthorized',
      retryable: false,
      ...options,
    });
  }
}

class LocalApiOriginError extends AppError {
  constructor(origin, options = {}) {
    super(`Origin not allowed: ${origin}`, {
      code: 'LOCAL_API_ORIGIN_DENIED',
      userMessage: 'error.api.originDenied',
      retryable: false,
      context: { origin },
      ...options,
    });
  }
}

class McpToolDeniedError extends AppError {
  constructor(tool, mode, options = {}) {
    super(`MCP tool '${tool}' denied in mode '${mode}'`, {
      code: 'MCP_TOOL_DENIED',
      userMessage: 'error.mcp.toolDenied',
      retryable: false,
      context: { tool, mode },
      ...options,
    });
    this.tool = tool;
    this.mode = mode;
  }
}

// =================================================================
// Cloud sync
// =================================================================

class CloudUploadFailedError extends AppError {
  constructor(provider, message, options = {}) {
    super(`Cloud upload to ${provider} failed: ${message}`, {
      code: 'CLOUD_UPLOAD_FAILED',
      userMessage: 'error.cloud.uploadFailed',
      retryable: true,
      context: { provider },
      ...options,
    });
  }
}

class CloudDownloadFailedError extends AppError {
  constructor(provider, message, options = {}) {
    super(`Cloud download from ${provider} failed: ${message}`, {
      code: 'CLOUD_DOWNLOAD_FAILED',
      userMessage: 'error.cloud.downloadFailed',
      retryable: true,
      context: { provider },
      ...options,
    });
  }
}

// =================================================================
// Store / persistence
// =================================================================

class StoreCorruptError extends AppError {
  constructor(storePath, options = {}) {
    super(`Store file is corrupt or unrecoverable: ${storePath}`, {
      code: 'STORE_CORRUPT',
      userMessage: 'error.store.corrupt',
      retryable: false,
      context: { storePath },
      ...options,
    });
  }
}

class StoreMigrationError extends AppError {
  constructor(fromVersion, toVersion, options = {}) {
    super(`Store migration failed: v${fromVersion} → v${toVersion}`, {
      code: 'STORE_MIGRATION_FAILED',
      userMessage: 'error.store.migrationFailed',
      retryable: false,
      context: { fromVersion, toVersion },
      ...options,
    });
  }
}

// =================================================================
// Validation / config
// =================================================================

class ValidationError extends AppError {
  constructor(field, message, options = {}) {
    super(`Validation failed for ${field}: ${message}`, {
      code: 'VALIDATION_FAILED',
      userMessage: 'error.validation.failed',
      retryable: false,
      context: { field, reason: message },
      ...options,
    });
    this.field = field;
  }
}

class ConfigError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'CONFIG_INVALID',
      userMessage: 'error.config.invalid',
      retryable: false,
      ...options,
    });
  }
}

// =================================================================
// Helpers
// =================================================================

/**
 * Convert any thrown value into an AppError instance. Useful at IPC boundaries
 * where arbitrary user-supplied data may be in the error path.
 *
 * @param {unknown} value
 * @returns {AppError}
 */
function toAppError(value) {
  if (value instanceof AppError) return value;
  if (value instanceof Error) {
    return new AppError(value.message, {
      code: value.code || null,
      cause: value,
      userMessage: 'error.unknown',
    });
  }
  return new AppError(String(value || 'unknown error'), {
    code: 'UNKNOWN_ERROR',
    userMessage: 'error.unknown',
  });
}

/**
 * Check whether a value looks like a specific error code.
 * Handles both AppError instances and plain Error with .code property.
 */
function hasCode(value, code) {
  if (!value || typeof value !== 'object') return false;
  return String(value.code || '') === String(code);
}

module.exports = {
  AppError,
  toAppError,
  hasCode,
  // Profile
  ProfileLockedError,
  ProfileLockUnrecoverableError,
  ProfileNotFoundError,
  ProfileAlreadyExistsError,
  ProfileStartFailedError,
  ProfileStopFailedError,
  InvalidProfileIdError,
  // Kernel
  KernelNotReadyError,
  KernelDownloadFailedError,
  KernelStartupTimeoutError,
  // Proxy
  ProxyUnreachableError,
  ProxyAuthFailedError,
  InvalidProxyError,
  // Fingerprint
  FingerprintConflictError,
  FingerprintInjectionFailedError,
  // RPA
  RpaPlanNotFoundError,
  RpaTaskNotFoundError,
  RpaStepFailedError,
  RpaTimeoutError,
  // Local API / MCP
  LocalApiAuthError,
  LocalApiOriginError,
  McpToolDeniedError,
  // Cloud
  CloudUploadFailedError,
  CloudDownloadFailedError,
  // Store
  StoreCorruptError,
  StoreMigrationError,
  // Validation
  ValidationError,
  ConfigError,
};
