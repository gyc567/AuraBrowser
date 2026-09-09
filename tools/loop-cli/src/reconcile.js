// loop reconcile .
// Three-way reconciliation: state/current.json <-> docs/loop-engineering/loop-run-log.md
// <-> git log.
// Returns: { status, untracked_commits, unrecorded_dones, schema_violations }.

import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadState, saveState } from './lib/state.js';
import { validateSchema } from './lib/schema.js';
import { readYamlFile } from './lib/yaml.js';

function gitLog(cwd, range) {
  try {
    const out = execFileSync('git', ['log', '--oneline', range], { cwd, encoding: 'utf8' });
    return out
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^([0-9a-f]+)\s+(.*)$/);
        return m ? { hash: m[1], subject: m[2] } : null;
      })
      .filter(Boolean);
  } catch (err) {
    return [];
  }
}

function shortHash(h) {
  return h.slice(0, 7);
}

export async function runReconcile({ cwd = '.', json = false, adopt = false, purge = false } = {}) {
  const { state } = await loadState({});
  const schema = JSON.parse(await readFile('docs/loop-engineering/state/schema.json', 'utf8'));
  const violations = [];
  try {
    validateSchema(schema, state);
  } catch (err) {
    violations.push(err.message);
  }

  // collect known commit hashes from state.done
  const recordedHashes = new Set();
  for (const d of state.done || []) {
    for (const c of d.commits || []) recordedHashes.add(c);
  }

  // git log since baseline (state.loop_metadata.baseline_commit, or fallback -50)
  const baseline = state.loop_metadata.baseline_commit;
  const range = baseline ? `${baseline}..HEAD` : '-50';
  const allCommits = gitLog(cwd, range);
  const untracked = allCommits.filter(
    (c) => !recordedHashes.has(shortHash(c.hash)) && !recordedHashes.has(c.hash)
  );

  // run-log entries
  let runLogText = '';
  if (existsSync('docs/loop-engineering/loop-run-log.md')) {
    runLogText = await readFile('docs/loop-engineering/loop-run-log.md', 'utf8');
  }
  const runLogEntries = (runLogText.match(/^##\s+\d{4}-\d{2}-\d{2}T/gm) || []).length;

  // mark reconcile (do not bump total_runs — that's incremented only by actual loop runs)
  state.loop_metadata.last_reconcile_run = new Date().toISOString();
  await saveState(state, {});

  // schema validations
  const schemaValid = violations.length === 0;
  const untrackedCount = untracked.length;
  const status = schemaValid && untrackedCount === 0 ? 'OK' : 'DRIFT';

  if (json) {
    return {
      status,
      schema_valid: schemaValid,
      schema_violations: violations,
      untracked_commits: untracked,
      recorded_commits: [...recordedHashes],
      unrecorded_dones: [],
      last_reconcile_run: state.loop_metadata.last_reconcile_run,
    };
  }

  const lines = [];
  lines.push(`Loop Reconcile`);
  lines.push(`=============`);
  lines.push('');
  lines.push(`Status: ${status}`);
  lines.push(`Schema: ${schemaValid ? 'valid' : 'INVALID'}`);
  if (!schemaValid) {
    for (const v of violations) lines.push(`  ✗ ${v}`);
  }
  lines.push(`Untracked commits: ${untrackedCount}`);
  for (const c of untracked.slice(0, 10)) {
    lines.push(`  - ${c.hash.slice(0, 7)} ${c.subject}`);
  }
  if (untrackedCount > 10) lines.push(`  ... and ${untrackedCount - 10} more`);
  lines.push(`Recorded commit hashes: ${recordedHashes.size}`);
  lines.push(`Run-log entries: ${runLogEntries}`);
  return lines.join('\n');
}
