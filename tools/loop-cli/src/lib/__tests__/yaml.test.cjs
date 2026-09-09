'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseYaml } = require('../../lib/yaml.js');

test('parseYaml: key-value flat', () => {
  assert.deepEqual(parseYaml('a: 1\nb: hello\n'), { a: 1, b: 'hello' });
});

test('parseYaml: nested 2-space', () => {
  const out = parseYaml('outer:\n  inner: 42\n');
  assert.deepEqual(out, { outer: { inner: 42 } });
});

test('parseYaml: list of objects (the case we care about)', () => {
  const text = `patterns:
  - id: alpha
    cadence: 1d
    level: L1
  - id: beta
    cadence: 2h
    level: L2
`;
  const out = parseYaml(text);
  assert.equal(out.patterns.length, 2);
  assert.equal(out.patterns[0].id, 'alpha');
  assert.equal(out.patterns[0].cadence, '1d');
  assert.equal(out.patterns[0].level, 'L1');
  assert.equal(out.patterns[1].id, 'beta');
  assert.equal(out.patterns[1].level, 'L2');
});

test('parseYaml: list of scalars', () => {
  const out = parseYaml('items:\n  - a\n  - b\n  - c\n');
  assert.deepEqual(out.items, ['a', 'b', 'c']);
});

test('parseYaml: comments stripped', () => {
  const out = parseYaml('a: 1 # inline\n# full line\nb: 2\n');
  assert.deepEqual(out, { a: 1, b: 2 });
});

test('parseYaml: boolean + null + integer + array', () => {
  const out = parseYaml('a: true\nb: false\nc: null\nd: 42\ne: [1, 2, 3]\n');
  assert.equal(out.a, true);
  assert.equal(out.b, false);
  assert.equal(out.c, null);
  assert.equal(out.d, 42);
  assert.deepEqual(out.e, [1, 2, 3]);
});

test('parseYaml: empty', () => {
  assert.deepEqual(parseYaml(''), {});
});
