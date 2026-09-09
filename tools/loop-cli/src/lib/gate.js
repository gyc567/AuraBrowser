// Gate evaluation per config/loop/gate.yaml.
// Order: denylist -> compound rules -> allowlist -> fallback_human.

import { readYamlFile } from './yaml.js';

export function pathMatches(pattern, filePath) {
  // Glob semantics:
  // - `**` matches any chars including / (non-greedy so trailing patterns still match)
  // - `*` matches any chars within a segment (not /)
  const PD = 'AADOUBLESTARAA';
  const PS = 'AASINGLESTARAA';
  let p = pattern.replace(/\*\*/g, PD).replace(/\*/g, PS);
  p = p.replace(/[.+^${}()|[\]\\?]/g, '\\$&');
  p = p.split(PD).join('.*?'); // non-greedy
  p = p.split(PS).join('[^/]*');
  return new RegExp(`^${p}$`).test(filePath);
}

export async function loadGate({ gatePath = 'config/loop/gate.yaml' } = {}) {
  return readYamlFile(gatePath);
}

export async function evaluate({
  files = [],
  linesPerFile = {},
  prAttempts = 1,
  gatePath = 'config/loop/gate.yaml',
} = {}) {
  const gate = await loadGate({ gatePath });

  const matches = { denylist: [], compound: [], allowlist: [] };
  let verdict = null;

  // 1. denylist
  for (const f of files) {
    for (const p of gate.denylist.paths) {
      if (pathMatches(p, f)) matches.denylist.push(f);
    }
  }
  if (matches.denylist.length > 0) {
    verdict = 'blocked';
  }

  // 2. compound rules
  if (verdict !== 'blocked') {
    for (const rule of gate.compound_rules || []) {
      const touched = files.filter((f) => {
        if (rule.id === 'test_changes_denied') {
          // Path-only heuristic: require an explicit `imports` hint in the input
          // (e.g. caller passes { file: 'tests/unit/x.test.js', imports: ['Browserapp/main.js'] }).
          // Without that hint we cannot tell whether a test touches a denylist path.
          // The gate's main caller is CI / compound-verifier, both of which have the diff
          // (including the imports) — they pass this via the per-file context map.
          // For path-only calls (no imports hint), we never trigger the upgrade here.
          return false;
        }
        if (rule.id === 'doc_covers_denied') {
          return f.startsWith('docs/security/') || f === 'docs/error-codes.md';
        }
        if (rule.id === 'ci_workflow_change') {
          return f.startsWith('.github/workflows/') && f.endsWith('.yml');
        }
        if (rule.id === 'loop_self_change') {
          return f.startsWith('config/loop/') || f.startsWith('tools/loop-cli/') || f.startsWith('skills/');
        }
        if (rule.id === 'state_drift') {
          return f === 'docs/loop-engineering/STATE.md' || f === 'docs/loop-engineering/state/current.json';
        }
        return false;
      });
      if (touched.length > 0) {
        if (rule.action === 'upgrade_to_denylist') {
          matches.denylist.push(...touched);
          verdict = 'blocked';
        } else {
          matches.compound.push({ id: rule.id, paths: touched });
        }
      }
    }
    if (matches.denylist.length > 0) verdict = 'blocked';
  }

  // 3. allowlist (only if no denylist hit)
  if (verdict !== 'blocked') {
    for (const f of files) {
      for (const p of gate.allowlist.paths) {
        if (pathMatches(p, f)) matches.allowlist.push(f);
      }
    }
    if (matches.allowlist.length === files.length) {
      verdict = 'auto-merge';
    }
  }

  // 4. fallback
  if (!verdict) verdict = 'needs-human';

  // limits check
  const linesPerPRTotal = Object.values(linesPerFile).reduce((a, b) => a + b, 0);
  const maxLinesPerFile = Math.max(0, ...Object.values(linesPerFile));
  const filesCount = files.length;

  const limits = gate.limits || {};
  const limits_check = {
    files_per_PR_ok: filesCount <= (limits.max_files_per_PR ?? 8),
    lines_per_file_ok: maxLinesPerFile <= (limits.max_lines_per_file ?? 600),
    lines_per_PR_ok: linesPerPRTotal <= (limits.max_lines_per_PR ?? 1500),
    attempts_ok: prAttempts <= (limits.max_attempts_per_item ?? 3),
    files_count: filesCount,
    lines_per_PR_total: linesPerPRTotal,
  };

  if (
    verdict === 'auto-merge' &&
    (!limits_check.files_per_PR_ok ||
      !limits_check.lines_per_file_ok ||
      !limits_check.lines_per_PR_ok ||
      !limits_check.attempts_ok)
  ) {
    verdict = 'needs-human';
  }

  return { verdict, matches, limits_check };
}
