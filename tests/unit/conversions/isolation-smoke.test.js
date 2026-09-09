'use strict';

// Smoke tests for automation/isolation.js exports.
// Full isolation semantics (lock acquisition, recovery) are covered by the
// integration selftest at automation/isolation-fingerprint-selftest.js.
// Here we just verify the module loads and exports the expected API.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const isolation = require('../../../Browserapp/automation/isolation');

test('isolation: exports expected function names', () => {
  const expected = [
    'lockPath',
    'acquireProfileLock',
    'updateProfileLock',
    'releaseProfileLock',
    'auditIsolation',
    'isSystemBrowserExecutable',
    'isPathInsideOrEqual',
    'validateDataRootIsolationSecure',
    'validateProfileRootSecure',
    'assertProfileId',
    'assertSafeProfileChild',
  ];
  for (const name of expected) {
    assert.equal(typeof isolation[name], 'function', `isolation.${name} should be a function`);
  }
});

test('isolation: lockPath returns .openbrowser-instance.lock inside the profile root', () => {
  const result = isolation.lockPath('/tmp/foo');
  assert.match(result, /\.openbrowser-instance\.lock$/);
});

test('isolation: assertProfileId accepts safe ids', () => {
  assert.doesNotThrow(() => isolation.assertProfileId('valid-id_123'));
  assert.doesNotThrow(() => isolation.assertProfileId('p-abc'));
});

test('isolation: assertProfileId rejects path traversal', () => {
  assert.throws(() => isolation.assertProfileId('../etc/passwd'));
  assert.throws(() => isolation.assertProfileId('id with spaces'));
  assert.throws(() => isolation.assertProfileId(''));
});

test('isolation: assertSafeProfileChild rejects escapes from profile root', async () => {
  await assert.rejects(isolation.assertSafeProfileChild('/tmp/profile', '/tmp/profile/../escape'));
  await assert.doesNotReject(isolation.assertSafeProfileChild('/tmp/profile', '/tmp/profile/child'));
});
