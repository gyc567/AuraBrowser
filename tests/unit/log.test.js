'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { redact, redactString, LEVELS } = require('../../Browserapp/lib/log');

test('redact replaces sensitive keys', () => {
  const input = {
    apiKey: 'sk-abc1234567890',
    password: 'hunter2',
    token: 'eyJhbGciOi...',
    cookie: 'session=xyz',
    authorization: 'Bearer xyz',
    api_key: 'snake_case_key',
    refreshToken: 'rt-123',
    username: 'alice', // not sensitive
    profileId: 'p-1', // not sensitive
  };
  const out = redact(input);
  assert.equal(out.apiKey, '[REDACTED]');
  assert.equal(out.password, '[REDACTED]');
  assert.equal(out.token, '[REDACTED]');
  assert.equal(out.cookie, '[REDACTED]');
  assert.equal(out.authorization, '[REDACTED]');
  assert.equal(out.api_key, '[REDACTED]');
  assert.equal(out.refreshToken, '[REDACTED]');
  assert.equal(out.username, 'alice');
  assert.equal(out.profileId, 'p-1');
});

test('redact handles nested objects and arrays', () => {
  const input = {
    profile: {
      id: 'p1',
      credentials: {
        apiKey: 'k1',
        proxy: {
          password: 'pp',
        },
      },
      tags: ['work', { token: 't1' }],
    },
  };
  const out = redact(input);
  assert.equal(out.profile.id, 'p1');
  assert.equal(out.profile.credentials.apiKey, '[REDACTED]');
  assert.equal(out.profile.credentials.proxy.password, '[REDACTED]');
  assert.equal(out.profile.tags[0], 'work');
  assert.equal(out.profile.tags[1].token, '[REDACTED]');
});

test('redact handles Error objects', () => {
  const error = new Error('connect ECONNREFUSED apiKey=hunter2');
  error.code = 'ECONNREFUSED';
  const out = redact(error);
  assert.equal(out.name, 'Error');
  assert.equal(out.code, 'ECONNREFUSED');
  assert.match(out.message, /\[REDACTED\]/);
  assert.doesNotMatch(out.message, /hunter2/);
});

test('redact handles circular references via WeakSet', () => {
  const obj = { id: 'p1' };
  obj.self = obj;
  const out = redact(obj);
  assert.equal(out.id, 'p1');
  assert.equal(out.self, '[circular]');
});

test('redactString masks long string by key', () => {
  const masked = redactString('password', 'super-secret-12345');
  assert.match(masked, /REDACTED/);
  assert.doesNotMatch(masked, /super-secret/);
});

test('redactString does not mask short non-sensitive keys', () => {
  const value = 'plain string content';
  assert.equal(redactString('message', value), value);
});

test('redact does not mutate input', () => {
  const input = { apiKey: 'k1', nested: { password: 'p1' } };
  const snapshot = JSON.stringify(input);
  redact(input);
  assert.equal(JSON.stringify(input), snapshot);
});

test('LEVELS orders trace < debug < info < warn < error < silent', () => {
  assert.ok(LEVELS.trace < LEVELS.debug);
  assert.ok(LEVELS.debug < LEVELS.info);
  assert.ok(LEVELS.info < LEVELS.warn);
  assert.ok(LEVELS.warn < LEVELS.error);
  assert.ok(LEVELS.error < LEVELS.silent);
});
