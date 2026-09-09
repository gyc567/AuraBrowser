'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parsedProxy, proxyHasCredentials, sameProxyEndpoint } = require('../../Browserapp/engine/proxy');

test('parsedProxy: returns parsed object for valid http URL', () => {
  const r = parsedProxy('http://example.com:8080');
  assert.ok(r && typeof r === 'object');
  assert.equal(r.host, 'example.com');
  assert.equal(r.port, 8080);
  assert.equal(r.protocol, 'http');
});

test('parsedProxy: returns null for null/undefined/empty/garbage', () => {
  assert.equal(parsedProxy(null), null);
  assert.equal(parsedProxy(undefined), null);
  assert.equal(parsedProxy(''), null);
  assert.equal(parsedProxy('   '), null);
  assert.equal(parsedProxy('not a url'), null);
});

test('parsedProxy: trims surrounding whitespace', () => {
  const r = parsedProxy('  http://h:1  ');
  assert.ok(r && r.host === 'h');
});

test('parsedProxy: tolerates parse errors without throwing', () => {
  // Force an unusual input that some parsers might throw on.
  assert.doesNotThrow(() => parsedProxy('\x00\x01\x02'));
});

test('proxyHasCredentials: true for URL with userinfo', () => {
  assert.equal(proxyHasCredentials('http://user:pass@example.com:8080'), true);
});

test('proxyHasCredentials: false for URL without userinfo', () => {
  assert.equal(proxyHasCredentials('http://example.com:8080'), false);
});

test('proxyHasCredentials: false for null/garbage', () => {
  assert.equal(proxyHasCredentials(null), false);
  assert.equal(proxyHasCredentials('not a url'), false);
  assert.equal(proxyHasCredentials(''), false);
});

test('sameProxyEndpoint: true for matching protocol+host+port', () => {
  assert.equal(sameProxyEndpoint('http://h:8080', 'http://h:8080'), true);
});

test('sameProxyEndpoint: true even with different credentials (only endpoint compared)', () => {
  assert.equal(sameProxyEndpoint('http://u1:p1@h:8080', 'http://u2:p2@h:8080'), true);
});

test('sameProxyEndpoint: false for different host', () => {
  assert.equal(sameProxyEndpoint('http://a:8080', 'http://b:8080'), false);
});

test('sameProxyEndpoint: false for different port', () => {
  assert.equal(sameProxyEndpoint('http://h:8080', 'http://h:9090'), false);
});

test('sameProxyEndpoint: false for different protocol', () => {
  assert.equal(sameProxyEndpoint('http://h:8080', 'https://h:8080'), false);
});

test('sameProxyEndpoint: false if either fails to parse', () => {
  assert.equal(sameProxyEndpoint('http://h:8080', 'garbage'), false);
  assert.equal(sameProxyEndpoint('garbage', 'http://h:8080'), false);
  assert.equal(sameProxyEndpoint(null, undefined), false);
});

test('sameProxyEndpoint: false if both parse to null', () => {
  assert.equal(sameProxyEndpoint('garbage', 'also garbage'), false);
});
