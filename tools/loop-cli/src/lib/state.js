// State read/write for STATE.md and state/current.json.
// Mirrors STATE.md <-> current.json. Renders STATE.md from JSON.
// Idempotent update: add rejects existing id; update rejects missing id; remove is no-op.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { validateSchema } from './schema.js';
import { withLock } from './lock.js';

const DEFAULT_STATE_PATH = 'docs/loop-engineering/STATE.md';
const DEFAULT_JSON_PATH = 'docs/loop-engineering/state/current.json';
const DEFAULT_SCHEMA_PATH = 'docs/loop-engineering/state/schema.json';
const DEFAULT_LOCK_PATH = 'docs/loop-engineering/state.lock';
const DEFAULT_HISTORY_DIR = 'docs/loop-engineering/state/history';

export async function loadState({ statePath = DEFAULT_STATE_PATH, jsonPath = DEFAULT_JSON_PATH } = {}) {
  const json = JSON.parse(await readFile(jsonPath, 'utf8'));
  return { state: json, statePath, jsonPath };
}

export async function saveState(
  state,
  {
    jsonPath = DEFAULT_JSON_PATH,
    statePath = DEFAULT_STATE_PATH,
    schemaPath = DEFAULT_SCHEMA_PATH,
    lockPath = DEFAULT_LOCK_PATH,
    historyDir = DEFAULT_HISTORY_DIR,
  } = {}
) {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  validateSchema(schema, state);

  return withLock(lockPath, async () => {
    // write JSON
    await writeFile(jsonPath, JSON.stringify(state, null, 2) + '\n', 'utf8');
    // snapshot to history
    if (!existsSync(historyDir)) {
      await mkdir(historyDir, { recursive: true });
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const snap = path.join(historyDir, `${ts}.json`);
    await writeFile(snap, JSON.stringify(state, null, 2) + '\n', 'utf8');
    // re-render STATE.md
    const md = renderStateMd(state);
    await writeFile(statePath, md, 'utf8');
    return { jsonPath, statePath, snapshot: snap };
  });
}

// Apply diff: { add: [...], update: [...], remove: [id, id, ...] }
export async function applyStateDiff(diff, opts) {
  const { state } = await loadState(opts);
  const conflicts = [];
  let applied = 0;

  for (const item of diff.remove || []) {
    const idx = state.high_priority.findIndex((x) => x.id === item);
    if (idx >= 0) {
      state.high_priority.splice(idx, 1);
      applied += 1;
    }
    // remove on missing id is no-op
  }

  for (const item of diff.add || []) {
    if (state.high_priority.some((x) => x.id === item.id)) {
      conflicts.push({ id: item.id, reason: 'already_exists' });
      continue;
    }
    state.high_priority.push({ ...item, added_at: new Date().toISOString() });
    applied += 1;
  }

  for (const patch of diff.update || []) {
    const idx = state.high_priority.findIndex((x) => x.id === patch.id);
    if (idx < 0) {
      conflicts.push({ id: patch.id, reason: 'not_found' });
      continue;
    }
    state.high_priority[idx] = {
      ...state.high_priority[idx],
      ...patch,
      updated_at: new Date().toISOString(),
    };
    applied += 1;
  }

  // update loop_metadata
  state.loop_metadata.last_reconcile_run = new Date().toISOString();

  await saveState(state, opts);
  return { applied, conflicts };
}

export function renderStateMd(state) {
  const lines = [];
  lines.push('# AuraBrowser STATE');
  lines.push('');
  lines.push('> Loop Engineering state file. Schema: state/schema.json');
  lines.push(`> Source of truth: state/current.json (machine-readable mirror)`);
  lines.push(`> Last reconcile: ${state.loop_metadata.last_reconcile_run || 'null'}`);
  lines.push('');
  lines.push('## High Priority (next PR slot)');
  lines.push('');
  if (state.high_priority.length === 0) {
    lines.push('(empty — first compound-slicer run will populate)');
  } else {
    for (const item of state.high_priority) {
      lines.push(`- [ ] **${item.id}**: ${item.slice}`);
      lines.push(`  - slice: ${item.slice}`);
      lines.push(`  - files-touched: ${item.files_touched}`);
      if (item.estimated_diff) lines.push(`  - estimated-diff: ${item.estimated_diff}`);
      if (item.human_gate) lines.push(`  - human-gate: ${item.human_gate}`);
      if (item.depends_on && item.depends_on.length > 0) {
        lines.push(`  - depends-on: [${item.depends_on.join(', ')}]`);
      }
      if (item.block && item.block.length > 0) {
        lines.push(`  - block: [${item.block.join(', ')}]`);
      }
      lines.push('');
    }
  }
  lines.push('## Watch (this week)');
  lines.push('');
  for (const w of state.watch || []) lines.push(`- ${w}`);
  lines.push('');
  lines.push('## Done (recent 30d, max 50)');
  lines.push('');
  for (const d of state.done || []) {
    const commits = d.commits ? ` (${d.commits.join(', ')})` : '';
    lines.push(`- ${d.date} ${d.title}${commits}`);
  }
  lines.push('');
  lines.push('## Loop Metadata');
  lines.push('');
  const m = state.loop_metadata;
  lines.push(`- last_triage_run: ${m.last_triage_run || 'null'}`);
  lines.push(`- last_audit_run: ${m.last_audit_run || 'null'}`);
  lines.push(`- last_reconcile_run: ${m.last_reconcile_run || 'null'}`);
  lines.push(`- last_audit_score: ${m.last_audit_score}`);
  lines.push(`- active_patterns: [${(m.active_patterns || []).join(', ')}]`);
  lines.push(`- paused_patterns: [${(m.paused_patterns || []).join(', ')}]`);
  lines.push(`- total_runs: ${m.total_runs}`);
  lines.push(`- operator_count_today: ${m.operator_count_today}`);
  lines.push(`- operator_count_total: ${m.operator_count_total}`);
  lines.push(`- time_spent_today_seconds: ${m.time_spent_today_seconds}`);
  lines.push(`- time_spent_total_seconds: ${m.time_spent_total_seconds}`);
  lines.push(`- schema_version: ${m.schema_version}`);
  lines.push(`- schema_validated_at: ${m.schema_validated_at || 'null'}`);
  lines.push('');
  return lines.join('\n');
}
