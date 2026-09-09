// loop doctor .
// Health checks: schema validity, file presence, gate consistency.

import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { loadState, saveState } from './lib/state.js';
import { validateSchema, SchemaError } from './lib/schema.js';
import { evaluate as gateEvaluate } from './lib/gate.js';
import { readYamlFile } from './lib/yaml.js';

const REQUIRED = [
  'config/loop/registry.yaml',
  'config/loop/compound.yaml',
  'config/loop/gate.yaml',
  'docs/loop-engineering/STATE.md',
  'docs/loop-engineering/loop-budget.md',
  'docs/loop-engineering/loop-run-log.md',
  'docs/loop-engineering/state/schema.json',
  'docs/loop-engineering/state/current.json',
];

const SCHEMA_FILES = ['docs/loop-engineering/state/schema.json'];

export async function runDoctor({ cwd = '.' } = {}) {
  const checks = [];

  // 1. file presence
  for (const f of REQUIRED) {
    checks.push({ name: `file: ${f}`, pass: existsSync(path(f, cwd)) });
  }

  // 2. schema validity of state/current.json
  for (const sf of SCHEMA_FILES) {
    const abs = path(sf, cwd);
    if (!existsSync(abs)) continue;
    try {
      const schema = JSON.parse(await readFile(abs, 'utf8'));
      const current = JSON.parse(
        await readFile(path('docs/loop-engineering/state/current.json', cwd), 'utf8')
      );
      try {
        validateSchema(schema, current);
        checks.push({ name: `schema: ${sf}`, pass: true });
      } catch (err) {
        checks.push({ name: `schema: ${sf}`, pass: false, detail: err.message });
      }
    } catch (err) {
      checks.push({ name: `schema: ${sf}`, pass: false, detail: err.message });
    }
  }

  // 3. YAML files parseable
  for (const yf of ['config/loop/registry.yaml', 'config/loop/compound.yaml', 'config/loop/gate.yaml']) {
    try {
      await readYamlFile(path(yf, cwd));
      checks.push({ name: `yaml: ${yf}`, pass: true });
    } catch (err) {
      checks.push({ name: `yaml: ${yf}`, pass: false, detail: err.message });
    }
  }

  // 4. gate self-consistency
  try {
    await gateEvaluate({
      files: ['tests/unit/sample.test.js'],
      gatePath: path('config/loop/gate.yaml', cwd),
    });
    checks.push({ name: 'gate: self-evaluate (allowlist path)', pass: true });
    const denyRes = await gateEvaluate({
      files: ['Browserapp/main.js'],
      gatePath: path('config/loop/gate.yaml', cwd),
    });
    checks.push({ name: 'gate: self-evaluate (denylist path)', pass: denyRes.verdict === 'blocked' });
  } catch (err) {
    checks.push({ name: 'gate: self-evaluate', pass: false, detail: err.message });
  }

  // 5. git head
  try {
    const { execFileSync } = await import('node:child_process');
    const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    checks.push({ name: `git: HEAD = ${head}`, pass: true });
  } catch (err) {
    checks.push({ name: 'git: HEAD readable', pass: false, detail: err.message });
  }

  const failed = checks.filter((c) => !c.pass);
  return {
    ok: failed.length === 0,
    passed: checks.length - failed.length,
    failed: failed.length,
    checks,
  };
}

function path(rel, cwd) {
  return `${cwd === '.' ? '' : cwd + '/'}${rel}`;
}
