'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSchema, isValid, SchemaError } = require('../../lib/schema.js');

const schema = {
  type: 'object',
  required: ['id', 'count'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 50, pattern: '^[A-Z]+$' },
    count: { type: 'integer', minimum: 0, maximum: 100 },
    tags: { type: 'array', maxItems: 3, items: { type: 'string' } },
    state: { enum: ['L0', 'L1', 'L2', 'L3'] },
    child: {
      type: 'object',
      required: ['x'],
      properties: { x: { type: 'number' } },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

test('validateSchema: passes for valid object', () => {
  assert.doesNotThrow(() =>
    validateSchema(schema, { id: 'ABC', count: 5, tags: ['a', 'b'], state: 'L1', child: { x: 1.5 } })
  );
});

test('validateSchema: rejects missing required', () => {
  assert.throws(() => validateSchema(schema, { count: 5 }), SchemaError);
});

test('validateSchema: rejects additional property', () => {
  assert.throws(() => validateSchema(schema, { id: 'ABC', count: 5, extra: 'oops' }), SchemaError);
});

test('validateSchema: rejects nested additional property', () => {
  assert.throws(() => validateSchema(schema, { id: 'ABC', count: 5, child: { x: 1, y: 2 } }), SchemaError);
});

test('validateSchema: enum rejection', () => {
  assert.throws(() => validateSchema(schema, { id: 'ABC', count: 5, state: 'L9' }), SchemaError);
});

test('validateSchema: pattern rejection', () => {
  assert.throws(() => validateSchema(schema, { id: 'lowercase', count: 5 }), SchemaError);
});

test('validateSchema: array maxItems', () => {
  assert.throws(
    () => validateSchema(schema, { id: 'ABC', count: 5, tags: ['a', 'b', 'c', 'd'] }),
    SchemaError
  );
});

test('isValid: returns false instead of throwing', () => {
  assert.equal(isValid(schema, { id: 'ABC', count: 0 }), true);
  assert.equal(isValid(schema, { id: 'lowercase', count: 0 }), false);
});
