'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  AppError,
  toAppError,
  hasCode,
  // Profile
  ProfileLockedError,
  ProfileLockUnrecoverableError,
  ProfileNotFoundError,
  ProfileAlreadyExistsError,
  ProfileStartFailedError,
  InvalidProfileIdError,
  // Kernel
  KernelNotReadyError,
  KernelStartupTimeoutError,
  // Proxy
  ProxyUnreachableError,
  ProxyAuthFailedError,
  InvalidProxyError,
  // Fingerprint
  FingerprintConflictError,
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
  // Store
  StoreCorruptError,
  StoreMigrationError,
  // Validation
  ValidationError,
  ConfigError,
} = require('../../Browserapp/lib/errors');

// =================================================================
// AppError base class
// =================================================================

test('AppError: preserves name, message, code, userMessage, retryable, cause', () => {
  const cause = new Error('ECONNREFUSED');
  const err = new AppError('top-level message', {
    code: 'TEST_CODE',
    userMessage: 'error.test',
    retryable: true,
    cause,
    context: { foo: 'bar' },
  });
  assert.equal(err.name, 'AppError');
  assert.equal(err.message, 'top-level message');
  assert.equal(err.code, 'TEST_CODE');
  assert.equal(err.userMessage, 'error.test');
  assert.equal(err.retryable, true);
  assert.equal(err.cause, cause);
  assert.deepEqual(err.context, { foo: 'bar' });
  assert.ok(err.stack.includes('AppError') || err.stack.includes('top-level'));
});

test('AppError: toJSON strips stack and exposes structured fields', () => {
  const err = new AppError('msg', { code: 'X', retryable: true, context: { a: 1 } });
  const json = err.toJSON();
  assert.equal(json.name, 'AppError');
  assert.equal(json.code, 'X');
  assert.equal(json.message, 'msg');
  assert.equal(json.retryable, true);
  assert.deepEqual(json.context, { a: 1 });
  assert.equal(json.cause, null);
  // Stack must NOT be in serialized form (avoids leaking paths)
  assert.equal(json.stack, undefined);
});

test('AppError: default retryable is undefined (falsy)', () => {
  const err = new AppError('msg', { code: 'X' });
  assert.notEqual(err.retryable, true);
});

// =================================================================
// Profile errors
// =================================================================

test('ProfileLockedError: default code + retryable=false', () => {
  const err = new ProfileLockedError('locked', { context: { pid: 1234 } });
  assert.equal(err.code, 'PROFILE_LOCKED');
  assert.equal(err.userMessage, 'error.profile.locked');
  assert.equal(err.retryable, false);
  assert.deepEqual(err.context, { pid: 1234 });
});

test('ProfileLockUnrecoverableError: distinct code', () => {
  const err = new ProfileLockUnrecoverableError('unrecoverable');
  assert.equal(err.code, 'PROFILE_LOCK_UNRECOVERABLE');
});

test('ProfileNotFoundError: stores profileId', () => {
  const err = new ProfileNotFoundError('p-abc-123');
  assert.equal(err.code, 'PROFILE_NOT_FOUND');
  assert.equal(err.profileId, 'p-abc-123');
  assert.equal(err.context.profileId, 'p-abc-123');
});

test('ProfileAlreadyExistsError: distinct code', () => {
  const err = new ProfileAlreadyExistsError('p-1');
  assert.equal(err.code, 'PROFILE_ALREADY_EXISTS');
  assert.equal(err.profileId, 'p-1');
});

test('ProfileStartFailedError: default retryable=true (transient)', () => {
  const err = new ProfileStartFailedError('boom');
  assert.equal(err.code, 'PROFILE_START_FAILED');
  assert.equal(err.retryable, true);
});

test('InvalidProfileIdError: stores id + reason', () => {
  const err = new InvalidProfileIdError('bad id!', 'whitespace');
  assert.equal(err.code, 'INVALID_PROFILE_ID');
  assert.equal(err.context.profileId, 'bad id!');
  assert.equal(err.context.reason, 'whitespace');
});

// =================================================================
// Kernel errors
// =================================================================

test('KernelNotReadyError: default retryable=true', () => {
  const err = new KernelNotReadyError('not ready');
  assert.equal(err.code, 'KERNEL_NOT_READY');
  assert.equal(err.retryable, true);
});

test('KernelStartupTimeoutError: distinct code', () => {
  const err = new KernelStartupTimeoutError('timeout');
  assert.equal(err.code, 'KERNEL_STARTUP_TIMEOUT');
});

// =================================================================
// Proxy errors (must redact credentials)
// =================================================================

test('ProxyUnreachableError: redacts password in proxy URL', () => {
  const err = new ProxyUnreachableError('http://user:hunter2@example.com:8080');
  assert.equal(err.code, 'PROXY_UNREACHABLE');
  assert.match(err.context.proxy, /\*/);
  assert.doesNotMatch(err.context.proxy, /hunter2/);
  // Top-level .proxy may contain password (intentional — IPC layer strips in toJSON)
  // But .context.proxy is safe for logs.
});

test('ProxyAuthFailedError: distinct code, retryable=false', () => {
  const err = new ProxyAuthFailedError('http://x:y@host:1');
  assert.equal(err.code, 'PROXY_AUTH_FAILED');
  assert.equal(err.retryable, false);
});

test('InvalidProxyError: stores value + reason', () => {
  const err = new InvalidProxyError('not a url', 'no scheme');
  assert.equal(err.code, 'INVALID_PROXY');
  assert.equal(err.context.reason, 'no scheme');
});

// =================================================================
// RPA errors
// =================================================================

test('RpaPlanNotFoundError: stores planId', () => {
  const err = new RpaPlanNotFoundError('plan-1');
  assert.equal(err.code, 'RPA_PLAN_NOT_FOUND');
  assert.equal(err.context.planId, 'plan-1');
});

test('RpaTaskNotFoundError: stores taskId', () => {
  const err = new RpaTaskNotFoundError('task-42');
  assert.equal(err.code, 'RPA_TASK_NOT_FOUND');
});

test('RpaStepFailedError: composes message from step + reason', () => {
  const err = new RpaStepFailedError('click', 'element not visible');
  assert.equal(err.code, 'RPA_STEP_FAILED');
  assert.match(err.message, /click/);
  assert.match(err.message, /element not visible/);
  assert.equal(err.stepType, 'click');
  assert.equal(err.retryable, false); // default
});

test('RpaTimeoutError: distinct code, retryable=true', () => {
  const err = new RpaTimeoutError('waitForSelector', 5000);
  assert.equal(err.code, 'RPA_TIMEOUT');
  assert.equal(err.retryable, true);
  assert.equal(err.context.timeoutMs, 5000);
});

// =================================================================
// Local API / MCP
// =================================================================

test('LocalApiAuthError: default message "unauthorized"', () => {
  const err = new LocalApiAuthError();
  assert.equal(err.code, 'LOCAL_API_UNAUTHORIZED');
  assert.equal(err.message, 'unauthorized');
});

test('LocalApiOriginError: stores origin', () => {
  const err = new LocalApiOriginError('https://attacker.example');
  assert.equal(err.code, 'LOCAL_API_ORIGIN_DENIED');
  assert.equal(err.context.origin, 'https://attacker.example');
});

test('McpToolDeniedError: stores tool + mode', () => {
  const err = new McpToolDeniedError('rpa_run_steps', 'read');
  assert.equal(err.code, 'MCP_TOOL_DENIED');
  assert.equal(err.tool, 'rpa_run_steps');
  assert.equal(err.mode, 'read');
});

// =================================================================
// Cloud / Store / Validation
// =================================================================

test('CloudUploadFailedError: stores provider', () => {
  const err = new CloudUploadFailedError('webdav', 'disk full');
  assert.equal(err.code, 'CLOUD_UPLOAD_FAILED');
  assert.equal(err.context.provider, 'webdav');
});

test('StoreCorruptError: stores storePath', () => {
  const err = new StoreCorruptError('/tmp/foo.json');
  assert.equal(err.code, 'STORE_CORRUPT');
  assert.equal(err.context.storePath, '/tmp/foo.json');
});

test('StoreMigrationError: stores versions', () => {
  const err = new StoreMigrationError(2, 3);
  assert.equal(err.code, 'STORE_MIGRATION_FAILED');
  assert.equal(err.context.fromVersion, 2);
  assert.equal(err.context.toVersion, 3);
});

test('ValidationError: stores field + reason', () => {
  const err = new ValidationError('proxy', 'must be http or socks5');
  assert.equal(err.code, 'VALIDATION_FAILED');
  assert.equal(err.field, 'proxy');
  assert.equal(err.context.reason, 'must be http or socks5');
});

test('ConfigError: accepts custom code', () => {
  const err = new ConfigError('bad cloud provider', { code: 'CLOUD_CONFIG_INVALID' });
  assert.equal(err.code, 'CLOUD_CONFIG_INVALID');
});

// =================================================================
// Fingerprint
// =================================================================

test('FingerprintConflictError: distinct code', () => {
  const err = new FingerprintConflictError('ua vs font mismatch');
  assert.equal(err.code, 'FINGERPRINT_CONFLICT');
  assert.equal(err.retryable, false);
});

// =================================================================
// Helpers
// =================================================================

test('toAppError: passes through AppError unchanged', () => {
  const original = new ProfileLockedError('test');
  const converted = toAppError(original);
  assert.equal(converted, original);
});

test('toAppError: wraps plain Error preserving code', () => {
  const plain = new Error('ECONNREFUSED');
  plain.code = 'ECONNREFUSED';
  const converted = toAppError(plain);
  assert.ok(converted instanceof AppError);
  assert.equal(converted.message, 'ECONNREFUSED');
  assert.equal(converted.code, 'ECONNREFUSED');
  assert.equal(converted.cause, plain);
});

test('toAppError: handles non-Error values', () => {
  assert.equal(toAppError('string').message, 'string');
  assert.equal(toAppError(42).message, '42');
  assert.equal(toAppError(null).message, 'unknown error');
  assert.equal(toAppError(undefined).message, 'unknown error');
});

test('hasCode: matches by string equality', () => {
  const err = new ProfileLockedError('test');
  assert.ok(hasCode(err, 'PROFILE_LOCKED'));
  assert.ok(!hasCode(err, 'PROFILE_NOT_FOUND'));
  assert.ok(!hasCode(null, 'PROFILE_LOCKED'));
  assert.ok(!hasCode({}, 'PROFILE_LOCKED'));
});

// =================================================================
// Inheritance chain
// =================================================================

test('every error subclass is an instanceof AppError and Error', () => {
  const samples = [
    new ProfileLockedError('x'),
    new KernelNotReadyError('x'),
    new ProxyUnreachableError('x://y'),
    new RpaStepFailedError('click', 'fail'),
    new LocalApiAuthError(),
    new CloudUploadFailedError('webdav', 'x'),
    new StoreCorruptError('/x'),
    new ValidationError('x', 'y'),
  ];
  for (const err of samples) {
    assert.ok(err instanceof AppError, `${err.constructor.name} instanceof AppError`);
    assert.ok(err instanceof Error, `${err.constructor.name} instanceof Error`);
    assert.equal(err.constructor.name, err.name);
    // Every error must have a code
    assert.ok(err.code && typeof err.code === 'string', `${err.constructor.name} has string code`);
  }
});
