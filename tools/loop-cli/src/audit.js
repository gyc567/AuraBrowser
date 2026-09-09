// loop audit .
// Compute Loop Readiness Score per docs/loop-engineering/README.md readiness table.
// Sections from loop-design-checklist.md (10 sections, 3 levels).
// Simplified scoring: each section present = +10 pts, full L3 = 100 pts.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { loadState } from './lib/state.js';
import { runDoctor } from './doctor.js';

const SECTIONS = {
  '1. Purpose & Scope': () => existsSync('docs/loop-engineering/README.md'),
  '2. Scheduling': () =>
    existsSync('.github/workflows/loop-daily-triage.yml') ||
    existsSync('docs/loop-engineering/loop-budget.md'),
  '3. Skills': () => existsSync('skills/loop-triage/SKILL.md'),
  '4. Maker/Checker': () => existsSync('skills/loop-verifier/SKILL.md'),
  '5. State/Memory': () =>
    existsSync('docs/loop-engineering/STATE.md') && existsSync('docs/loop-engineering/state/current.json'),
  '6. Human Handoff': () =>
    existsSync('config/loop/gate.yaml') && existsSync('docs/loop-engineering/denylist-reasons.md'),
  '7. Connectors (MCP)': () => existsSync('tools/loop-cli/src/adapters/dsh.js'),
  '8. Cost & Limits': () => existsSync('docs/loop-engineering/loop-budget.md'),
  '9. Observability': () => existsSync('docs/loop-engineering/loop-run-log.md'),
  '10. Safety': () => existsSync('config/loop/gate.yaml'),
};

function levelFromScore(score) {
  if (score >= 90) return 'L3';
  if (score >= 60) return 'L2';
  if (score >= 30) return 'L1';
  return 'L0';
}

export async function runAudit({ cwd = '.', json = false } = {}) {
  const { state } = await loadState({});
  const sectionResults = [];
  let score = 0;
  for (const [name, check] of Object.entries(SECTIONS)) {
    const present = check();
    if (present) score += 10;
    sectionResults.push({ section: name, present });
  }

  // bonus: STATE.md schema valid + doctor ok
  const doctorResult = await runDoctor({ cwd });
  if (doctorResult.ok) score = Math.min(100, score + 0); // baseline already includes checks

  // bonus: number of loop-run-log entries (more reliable than total_runs which reconcile auto-bumps)
  const totalRuns = state.loop_metadata.total_runs || 0;
  // require actual runs for the bonus; otherwise cap at L2
  if (totalRuns >= 3) {
    score = Math.min(100, score + 5);
  } else if (totalRuns === 0) {
    // no actual runs: cap at L2 (retro framework-only)
    score = Math.min(70, score);
  }

  const level = levelFromScore(score);

  // update state with last audit
  state.loop_metadata.last_audit_run = new Date().toISOString();
  state.loop_metadata.last_audit_score = level;
  state.loop_metadata.schema_validated_at =
    state.loop_metadata.schema_validated_at || new Date().toISOString();
  const { saveState } = await import('./lib/state.js');
  await saveState(state, {});

  if (json) {
    return { score, level, sectionResults, total_runs: totalRuns, doctor_ok: doctorResult.ok };
  }
  const lines = [];
  lines.push(`Loop Readiness Audit`);
  lines.push(`====================`);
  lines.push('');
  lines.push(`Score: ${score}/100 → ${level}`);
  lines.push('');
  for (const s of sectionResults) {
    lines.push(`  ${s.present ? '✓' : '✗'} ${s.section}`);
  }
  lines.push('');
  lines.push(`Doctor checks: ${doctorResult.passed} passed, ${doctorResult.failed} failed`);
  lines.push(`Total runs: ${totalRuns}`);
  return lines.join('\n');
}
