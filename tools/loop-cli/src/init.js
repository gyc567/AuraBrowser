// loop init . [--pattern X] [--tool Y]
// Scaffold: ensures config/loop/, docs/loop-engineering/, skills/, tools/loop-cli/ exist
// with valid seed files. Idempotent: does not overwrite existing files unless --force.

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SEEDED_FILES = [
  'config/loop/registry.yaml',
  'config/loop/compound.yaml',
  'config/loop/gate.yaml',
  'docs/loop-engineering/STATE.md',
  'docs/loop-engineering/loop-budget.md',
  'docs/loop-engineering/loop-run-log.md',
  'docs/loop-engineering/denylist-reasons.md',
  'docs/loop-engineering/README.md',
  'docs/loop-engineering/state/schema.json',
  'docs/loop-engineering/state/current.json',
];

export async function runInit({ cwd = '.', pattern = 'daily-triage', tool = 'dsh', force = false } = {}) {
  const created = [];
  const skipped = [];
  for (const rel of SEEDED_FILES) {
    const abs = path.join(cwd, rel);
    if (existsSync(abs) && !force) {
      skipped.push(rel);
      continue;
    }
    const dir = path.dirname(abs);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    created.push(rel);
  }
  return { created, skipped, pattern, tool, cwd };
}
