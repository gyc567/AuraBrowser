'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Reuse the source-extraction trick from the original selftest: pull the
// pure resolveColorMode / readSavedColorPreference out of renderer.js so we
// exercise the actual shipped logic, not a copy.

const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'Browserapp', 'renderer.js'), 'utf8');
function grab(name, re) {
  const m = src.match(re);
  if (!m) throw new Error(`could not extract ${name} from renderer.js`);
  return m[0];
}
const resolveSrc = grab('resolveColorMode', /function resolveColorMode\(pref, prefersDark\) \{[\s\S]*?\n\}/);
const readSrc = grab('readSavedColorPreference', /function readSavedColorPreference\(\) \{[\s\S]*?\n\}/);

let storeValue = null;
const localStorage = { getItem: () => storeValue };
const UI_COLOR_MODE_KEY = 'openbrowser-ui-color-mode-v1';
const systemPrefersDark = () => false;

const { resolveColorMode, readSavedColorPreference } = new Function(
  'localStorage',
  'UI_COLOR_MODE_KEY',
  'systemPrefersDark',
  `${resolveSrc}\n${readSrc}\nreturn { resolveColorMode, readSavedColorPreference };`
)(localStorage, UI_COLOR_MODE_KEY, systemPrefersDark);

// =================================================================
// resolveColorMode
// =================================================================

test('resolveColorMode: light preference overrides system dark', () => {
  assert.equal(resolveColorMode('light', true), 'light');
});

test('resolveColorMode: light preference overrides system light', () => {
  assert.equal(resolveColorMode('light', false), 'light');
});

test('resolveColorMode: dark preference overrides system light', () => {
  assert.equal(resolveColorMode('dark', false), 'dark');
});

test('resolveColorMode: dark preference stays dark when system agrees', () => {
  assert.equal(resolveColorMode('dark', true), 'dark');
});

test('resolveColorMode: auto + system dark → dark', () => {
  assert.equal(resolveColorMode('auto', true), 'dark');
});

test('resolveColorMode: auto + system light → light', () => {
  assert.equal(resolveColorMode('auto', false), 'light');
});

test('resolveColorMode: unknown preference falls back to light', () => {
  assert.equal(resolveColorMode('nonsense', false), 'light');
});

test('resolveColorMode: undefined preference falls back to light', () => {
  assert.equal(resolveColorMode(undefined, true), 'light');
});

// =================================================================
// readSavedColorPreference
// =================================================================

test('readSavedColorPreference: no stored value → auto', () => {
  storeValue = null;
  assert.equal(readSavedColorPreference(), 'auto');
});

test('readSavedColorPreference: stored "auto" → auto', () => {
  storeValue = 'auto';
  assert.equal(readSavedColorPreference(), 'auto');
});

test('readSavedColorPreference: stored "light" → light', () => {
  storeValue = 'light';
  assert.equal(readSavedColorPreference(), 'light');
});

test('readSavedColorPreference: stored "dark" → dark', () => {
  storeValue = 'dark';
  assert.equal(readSavedColorPreference(), 'dark');
});

test('readSavedColorPreference: stored garbage → auto (safe default)', () => {
  storeValue = 'garbage-value';
  assert.equal(readSavedColorPreference(), 'auto');
});
