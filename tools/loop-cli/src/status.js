// loop status . [--json]
// Print current state from state/current.json (or fallback to STATE.md if missing).

import { loadState } from './lib/state.js';

export async function runStatus({ cwd = '.', json = false } = {}) {
  const { state } = await loadState({});
  if (json) {
    return state;
  }
  // human-readable summary
  const lines = [];
  lines.push('AuraBrowser Loop Status');
  lines.push('======================');
  lines.push('');
  lines.push(`audit_score: ${state.loop_metadata.last_audit_score}`);
  lines.push(`total_runs: ${state.loop_metadata.total_runs}`);
  lines.push(`active_patterns: [${(state.loop_metadata.active_patterns || []).join(', ')}]`);
  lines.push(`paused_patterns: [${(state.loop_metadata.paused_patterns || []).join(', ')}]`);
  lines.push('');
  lines.push(`High Priority (${state.high_priority.length}):`);
  if (state.high_priority.length === 0) {
    lines.push('  (empty)');
  } else {
    for (const item of state.high_priority) {
      lines.push(
        `  - ${item.id}: ${item.slice} [files=${item.files_touched}, deps=${(item.depends_on || []).length}]`
      );
    }
  }
  lines.push('');
  lines.push(`Watch (${state.watch.length}):`);
  for (const w of state.watch) lines.push(`  - ${w}`);
  lines.push('');
  lines.push(`Done (${state.done.length}, max 50):`);
  for (const d of state.done.slice(-5)) {
    lines.push(`  - ${d.date} ${d.title}`);
  }
  return lines.join('\n');
}
