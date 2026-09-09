// Minimal JSON Schema validator for loop-cli.
// Supports: type (string/number/boolean/array/object/null), required, properties,
// additionalProperties (false), items, enum, format (date-time/date), pattern,
// minLength/maxLength/minimum/maximum, maxItems.
// Does NOT support: $ref/$defs/allOf/oneOf/if-then-else (avoid them in schemas).

export class SchemaError extends Error {
  constructor(path, expected, actual) {
    super(`schema violation at ${path || '/'}: expected ${expected}, got ${actual}`);
    this.code = 'SCHEMA_VIOLATION';
    this.path = path;
  }
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function validate(schema, value, path = '') {
  if (schema === true) return;
  if (schema === false) {
    throw new SchemaError(path, 'any', JSON.stringify(value));
  }
  if (typeof schema !== 'object') return;

  // type
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOf(value);
    if (!types.includes(actual)) {
      throw new SchemaError(path, types.join('|'), actual);
    }
  }

  // enum
  if (schema.enum) {
    if (!schema.enum.some((e) => e === value)) {
      throw new SchemaError(path, `one of ${schema.enum.join('|')}`, JSON.stringify(value));
    }
  }

  // const
  if (schema.const !== undefined && schema.const !== value) {
    throw new SchemaError(path, `const ${JSON.stringify(schema.const)}`, JSON.stringify(value));
  }

  // string checks
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      throw new SchemaError(path, `minLength ${schema.minLength}`, `length ${value.length}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      throw new SchemaError(path, `maxLength ${schema.maxLength}`, `length ${value.length}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      throw new SchemaError(path, `pattern ${schema.pattern}`, JSON.stringify(value));
    }
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) {
      throw new SchemaError(path, 'date-time', value);
    }
    if (schema.format === 'date' && !/^\d{4}-\d{2}-\d{2}/.test(value)) {
      throw new SchemaError(path, 'date', value);
    }
  }

  // number checks
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      throw new SchemaError(path, `>= ${schema.minimum}`, value);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      throw new SchemaError(path, `<= ${schema.maximum}`, value);
    }
  }

  // array checks
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      throw new SchemaError(path, `maxItems ${schema.maxItems}`, `length ${value.length}`);
    }
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      throw new SchemaError(path, `minItems ${schema.minItems}`, `length ${value.length}`);
    }
    if (schema.items) {
      value.forEach((item, i) => validate(schema.items, item, `${path}/${i}`));
    }
  }

  // object checks
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const required = schema.required || [];
    for (const k of required) {
      if (!(k in value)) {
        throw new SchemaError(`${path}/${k}`, 'required', 'missing');
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      for (const k of Object.keys(value)) {
        if (!allowed.has(k)) {
          throw new SchemaError(`${path}/${k}`, 'not allowed', k);
        }
      }
    }
    if (schema.properties) {
      for (const [k, sub] of Object.entries(schema.properties)) {
        if (k in value) validate(sub, value[k], `${path}/${k}`);
      }
    }
  }
}

export function validateSchema(schema, value) {
  validate(schema, value);
  return true;
}

export function isValid(schema, value) {
  try {
    validateSchema(schema, value);
    return true;
  } catch {
    return false;
  }
}
