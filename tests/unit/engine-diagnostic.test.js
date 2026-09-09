'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const {
  appendDiagnosticOutput,
  formatBrowserStartupError,
  writeBrowserStartupDiagnostic,
  STARTUP_DIAGNOSTIC_LIMIT,
  STARTUP_LOG_TRIGGER_BYTES,
  STARTUP_LOG_KEEP_BYTES,
} = require('../../Browserapp/engine/diagnostic');

test('appendDiagnosticOutput: appends string and trims to limit', () => {
  const result = appendDiagnosticOutput('hello', ' world');
  assert.equal(result, 'hello world');
});

test('appendDiagnosticOutput: handles Buffer chunk', () => {
  const result = appendDiagnosticOutput('', Buffer.from('buf-content', 'utf8'));
  assert.equal(result, 'buf-content');
});

test('appendDiagnosticOutput: respects STARTUP_DIAGNOSTIC_LIMIT on overflow', () => {
  const long = 'x'.repeat(STARTUP_DIAGNOSTIC_LIMIT + 1000);
  const result = appendDiagnosticOutput('prefix:', long);
  assert.equal(result.length, STARTUP_DIAGNOSTIC_LIMIT);
  // After truncation we keep the *tail* of the concatenation; the prefix may not survive.
  // The contract is bounded length + tail of concatenated string.
  assert.equal(result, ('prefix:' + long).slice(-STARTUP_DIAGNOSTIC_LIMIT));
});

test('appendDiagnosticOutput: tolerates null/undefined', () => {
  assert.equal(appendDiagnosticOutput(null, 'x'), 'x');
  assert.equal(appendDiagnosticOutput('abc', null), 'abc');
  assert.equal(appendDiagnosticOutput(undefined, undefined), '');
});

test('formatBrowserStartupError: bare string passes through with [executable] idempotency', () => {
  const out = formatBrowserStartupError('boom');
  assert.equal(out, 'boom');
});

test('formatBrowserStartupError: idempotent on already-decorated message', () => {
  const decorated = 'boom [executable=/path/to/bin; pid=42]';
  const out = formatBrowserStartupError(decorated, { pid: 999 }, { launchBinary: '/new' });
  assert.equal(out, decorated);
});

test('formatBrowserStartupError: builds decoration from child + diagnostic', () => {
  const out = formatBrowserStartupError(
    'Browser exited',
    { pid: 42, exitCode: 1 },
    {
      launchBinary: '/usr/bin/chrome',
      profileRoot: '/tmp/p1',
      stderr: 'oh no',
    }
  );
  assert.match(out, /^Browser exited \[/);
  assert.match(out, /executable=\/usr\/bin\/chrome/);
  assert.match(out, /profile=\/tmp\/p1/);
  assert.match(out, /pid=42/);
  assert.match(out, /exitCode=1/);
  assert.match(out, /browserOutput=oh no/);
});

test('formatBrowserStartupError: Error object extracts message', () => {
  const out = formatBrowserStartupError(new Error('child exited'), { pid: 7 }, {});
  assert.match(out, /^child exited \[pid=7\]/);
});

test('formatBrowserStartupError: null/undefined child does not crash', () => {
  const out = formatBrowserStartupError('plain', null, {});
  assert.equal(out, 'plain');
  const out2 = formatBrowserStartupError('plain', undefined, { launchBinary: '/x' });
  assert.equal(out2, 'plain [executable=/x]');
});

test('formatBrowserStartupError: trims whitespace around base', () => {
  assert.equal(formatBrowserStartupError('  trim me  '), 'trim me');
});

test('writeBrowserStartupDiagnostic: writes one JSONL line per call', async (t) => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'diag-'));
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  await writeBrowserStartupDiagnostic(tmp, { kind: 'probe', profileId: 'p1' });
  await writeBrowserStartupDiagnostic(tmp, { kind: 'probe', profileId: 'p2' });
  const logFile = path.join(tmp, 'logs', 'browser-startup.log');
  const content = await fsp.readFile(logFile, 'utf8');
  const lines = content.trim().split('\n');
  assert.equal(lines.length, 2);
  for (const line of lines) {
    const obj = JSON.parse(line);
    assert.ok(typeof obj.at === 'string' && obj.at.length > 0);
  }
});

test('writeBrowserStartupDiagnostic: rotates when file exceeds trigger bytes', async (t) => {
  // trigger is 512 KB; use a smaller artificial trigger via repeated appending to force rotation
  // Easiest: write one huge record; the appendFile will push us past 512 KB in one shot.
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'diag-rotate-'));
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const big = { payload: 'X'.repeat(STARTUP_LOG_TRIGGER_BYTES + 1024) };
  await writeBrowserStartupDiagnostic(tmp, big);
  const logFile = path.join(tmp, 'logs', 'browser-startup.log');
  const stat = await fsp.stat(logFile);
  // After rotation, file size should be at most trigger + the appended line.
  // Concretely: rotation keeps last 256 KB. Subsequent appends may add more.
  // So the bound is STARTUP_LOG_KEEP_BYTES + appended-line-length, not the raw trigger.
  assert.ok(stat.size <= STARTUP_LOG_KEEP_BYTES + 1024 + 64, `size ${stat.size} > bound`);
});

test('writeBrowserStartupDiagnostic: swallows errors (best-effort)', async (t) => {
  // Passing an invalid path (root-owned dir) should not throw.
  // We use an obviously-bad path: a regular file used as a directory.
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'diag-bad-'));
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const filePath = path.join(tmp, 'not-a-dir');
  await fsp.writeFile(filePath, 'i am a file');
  await assert.doesNotReject(writeBrowserStartupDiagnostic(filePath, { kind: 'should-not-throw' }));
});
