'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathMatches, evaluate } = require('../../lib/gate.js');

test('pathMatches: exact match', () => {
  assert.equal(pathMatches('Browserapp/main.js', 'Browserapp/main.js'), true);
  assert.equal(pathMatches('Browserapp/main.js', 'Browserapp/other.js'), false);
});

test('pathMatches: single * matches within segment', () => {
  assert.equal(pathMatches('Browserapp/*.js', 'Browserapp/main.js'), true);
  assert.equal(pathMatches('Browserapp/*.js', 'Browserapp/sub/main.js'), false);
});

test('pathMatches: ** matches any depth, * matches within a segment', () => {
  // `**/` zero-or-more dirs; `*` matches the filename stem (no slash, but may include -).
  assert.equal(pathMatches('**/*-selftest.js', 'Browserapp/automation/automation-selftest.js'), true);
  assert.equal(pathMatches('**/*-selftest.js', 'a/b/c/foo-selftest.js'), true);
  assert.equal(pathMatches('**/*-selftest.js', 'Browserapp/main.js'), false);
  assert.equal(pathMatches('**/*-selftest.js', 'a/b/my-test.selftest.js'), false); // .selftest, not -selftest
});

test('pathMatches: dot escapes', () => {
  assert.equal(pathMatches('.github/workflows/*.yml', '.github/workflows/loop.yml'), true);
  assert.equal(pathMatches('.github/workflows/*.yml', '.github/workflows/sub/loop.yml'), false);
});

test('evaluate: allowlist path returns auto-merge', async () => {
  const r = await evaluate({ files: ['tests/unit/sample.test.js'] });
  assert.equal(r.verdict, 'auto-merge');
});

test('evaluate: denylist path returns blocked', async () => {
  const r = await evaluate({ files: ['Browserapp/main.js'] });
  assert.equal(r.verdict, 'blocked');
  assert.ok(r.matches.denylist.includes('Browserapp/main.js'));
});

test('evaluate: test in tests/ without explicit imports hint stays allowlist', async () => {
  // test_changes_denied requires an explicit `imports` hint (CI/compound-verifier provides it).
  // Path-only check (no imports) never triggers the upgrade.
  const r = await evaluate({ files: ['tests/unit/main-spec.test.js'] });
  assert.equal(r.verdict, 'auto-merge');
});

test('evaluate: ci workflow triggers 2-reviewer compound', async () => {
  const r = await evaluate({ files: ['.github/workflows/loop.yml'] });
  assert.ok(r.matches.compound.some((c) => c.id === 'ci_workflow_change'));
});

test('evaluate: loop self-change triggers audit compound', async () => {
  const r = await evaluate({ files: ['config/loop/gate.yaml'] });
  assert.ok(r.matches.compound.some((c) => c.id === 'loop_self_change'));
});

test('evaluate: limits cap files_per_PR', async () => {
  const r = await evaluate({ files: Array.from({ length: 9 }, (_, i) => `tests/unit/t${i}.test.js`) });
  assert.equal(r.limits_check.files_per_PR_ok, false);
});
