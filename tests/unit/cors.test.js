'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const fsp = require('node:fs/promises');

const { LocalApiServer } = require('../../Browserapp/automation/local-api-server');

function makeMockEngine() {
  return {
    profiles: new Map(),
    running: new Set(),
    syncProfiles() {},
    getProfileDataRoot: () => '/tmp',
    kernelBootstrapPromise: null,
  };
}

async function startServer(options) {
  const userData = await fsp.mkdtemp(path.join(os.tmpdir(), 'cors-test-'));
  const server = new LocalApiServer({
    engine: makeMockEngine(),
    apiKey: 'test-cors-key',
    ...options,
  });
  await server.start();
  return {
    server,
    cleanup: async () => {
      await server.stop().catch(() => {});
      await fsp.rm(userData, { recursive: true, force: true }).catch(() => {});
    },
  };
}

function request({ port, origin, method = 'GET', path = '/api/getVersion', apiKey }) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (origin !== null) headers.Origin = origin;
    if (origin === null) headers.Origin = '';
    if (apiKey) headers['api-key'] = apiKey;
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      );
    });
    req.on('error', reject);
    req.end();
  });
}

test('default CORS allowlist permits file:// origin', async (t) => {
  const { server, cleanup } = await startServer();
  t.after(cleanup);
  const res = await request({ port: server.port, origin: 'file://', apiKey: 'test-cors-key' });
  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'file://');
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.match(res.headers['referrer-policy'], /no-referrer/);
});

test('default CORS allowlist permits null origin (Electron pages)', async (t) => {
  const { server, cleanup } = await startServer();
  t.after(cleanup);
  const res = await request({ port: server.port, origin: 'null', apiKey: 'test-cors-key' });
  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'null');
});

test('default CORS allowlist permits app:// origin', async (t) => {
  const { server, cleanup } = await startServer();
  t.after(cleanup);
  const res = await request({ port: server.port, origin: 'app://openbrowser', apiKey: 'test-cors-key' });
  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'app://openbrowser');
});

test('default CORS allowlist DENIES external browser origin', async (t) => {
  const { server, cleanup } = await startServer();
  t.after(cleanup);
  const res = await request({
    port: server.port,
    origin: 'https://attacker.example',
    apiKey: 'test-cors-key',
  });
  assert.equal(res.status, 403);
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('default CORS allowlist DENIES http://localhost:8080', async (t) => {
  const { server, cleanup } = await startServer();
  t.after(cleanup);
  const res = await request({ port: server.port, origin: 'http://localhost:8080', apiKey: 'test-cors-key' });
  assert.equal(res.status, 403);
});

test('no Origin header: bypass CORS, request succeeds', async (t) => {
  const { server, cleanup } = await startServer();
  t.after(cleanup);
  const res = await request({ port: server.port, origin: null, apiKey: 'test-cors-key' });
  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('custom allowedOrigins can extend the list', async (t) => {
  const { server, cleanup } = await startServer({ allowedOrigins: ['https://trusted.example'] });
  t.after(cleanup);
  const trustedRes = await request({
    port: server.port,
    origin: 'https://trusted.example',
    apiKey: 'test-cors-key',
  });
  assert.equal(trustedRes.status, 200);
  assert.equal(trustedRes.headers['access-control-allow-origin'], 'https://trusted.example');
  const defaultRes = await request({ port: server.port, origin: 'file://', apiKey: 'test-cors-key' });
  // Custom array REPLACES defaults (does not extend them).
  assert.equal(defaultRes.status, 403);
});

test('allowedOrigins: null → exact match only, no defaults', async (t) => {
  const { server, cleanup } = await startServer({ allowedOrigins: null });
  t.after(cleanup);
  const res = await request({ port: server.port, origin: 'file://', apiKey: 'test-cors-key' });
  assert.equal(res.status, 403);
});

test('every response carries security headers', async (t) => {
  const { server, cleanup } = await startServer();
  t.after(cleanup);
  const res = await request({ port: server.port, origin: null, apiKey: 'test-cors-key' });
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.match(res.headers['referrer-policy'], /no-referrer/);
  assert.match(res.headers['permissions-policy'], /geolocation=/);
});
