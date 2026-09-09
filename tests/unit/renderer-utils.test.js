'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { formatBytes, createGroupId, positiveProfileNumber } = require('../../Browserapp/renderer/utils');

test('formatBytes: 0 renders as 1 KB (min)', () => {
  assert.equal(formatBytes(0), '1 KB');
});

test('formatBytes: small values render in KB rounded', () => {
  assert.equal(formatBytes(512), '1 KB');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(1024 * 100), '100 KB');
});

test('formatBytes: >= 1 MB renders with 1 decimal place', () => {
  assert.equal(formatBytes(1024 * 1024), '1.0 MB');
  assert.equal(formatBytes(1024 * 1024 * 1.5), '1.5 MB');
  assert.equal(formatBytes(1024 * 1024 * 100), '100.0 MB');
});

test('formatBytes: handles string numbers', () => {
  assert.equal(formatBytes('2048'), '2 KB');
  assert.equal(formatBytes('1048576'), '1.0 MB');
});

test('formatBytes: non-numeric / null / undefined → 0 → 1 KB', () => {
  assert.equal(formatBytes(null), '1 KB');
  assert.equal(formatBytes(undefined), '1 KB');
  assert.equal(formatBytes('not a number'), '1 KB');
  assert.equal(formatBytes({}), '1 KB');
});

test('formatBytes: KB cut-off is 1 MB (1024*1024)', () => {
  // exactly 1 MB - 1 byte is still KB
  assert.equal(formatBytes(1024 * 1024 - 1), '1024 KB');
  // exactly 1 MB switches to MB
  assert.equal(formatBytes(1024 * 1024), '1.0 MB');
});

test('createGroupId: returns a string with grp- prefix', () => {
  const id = createGroupId();
  assert.equal(typeof id, 'string');
  assert.ok(id.startsWith('grp-'));
  assert.ok(id.length > 'grp-'.length + 4);
});

test('createGroupId: two consecutive calls return different ids', () => {
  const a = createGroupId();
  const b = createGroupId();
  assert.notEqual(a, b);
});

test('positiveProfileNumber: positive integers round-trip', () => {
  assert.equal(positiveProfileNumber(1), 1);
  assert.equal(positiveProfileNumber(42), 42);
  assert.equal(positiveProfileNumber(999999), 999999);
});

test('positiveProfileNumber: string numbers coerce', () => {
  assert.equal(positiveProfileNumber('7'), 7);
  assert.equal(positiveProfileNumber('42'), 42);
});

test('positiveProfileNumber: 0, negative, NaN, null → 0', () => {
  assert.equal(positiveProfileNumber(0), 0);
  assert.equal(positiveProfileNumber(-5), 0);
  assert.equal(positiveProfileNumber(NaN), 0);
  assert.equal(positiveProfileNumber(null), 0);
  assert.equal(positiveProfileNumber(undefined), 0);
});

test('positiveProfileNumber: non-numeric strings → 0', () => {
  assert.equal(positiveProfileNumber('abc'), 0);
  assert.equal(positiveProfileNumber(''), 0);
});

// Note: parseInt('12abc') = 12. So positiveProfileNumber('12abc') actually returns 12.
// This is the upstream behavior, not a bug.
test('positiveProfileNumber: parseInt-trailing-string quirk is preserved', () => {
  assert.equal(positiveProfileNumber('12abc'), 12);
  assert.equal(positiveProfileNumber('3.14'), 3); // parseInt floors
});

test('UMD-lite: module.exports is set (CommonJS path)', () => {
  const m = require('../../Browserapp/renderer/utils');
  assert.equal(typeof m.formatBytes, 'function');
  assert.equal(typeof m.createGroupId, 'function');
  assert.equal(typeof m.positiveProfileNumber, 'function');
});
