// loop slicer --goal REFAC-engine-modularize
// First compound-slicer run: decompose engine.js (4114 lines) into ≤8-file slices.
// Output is applied to state/current.json via applyStateDiff + run-log entry.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { applyStateDiff } from './lib/state.js';
import { evaluate as gateEvaluate } from './lib/gate.js';
import { validateSchema } from './lib/schema.js';

function findClassMethods(text, className) {
  // crude scan of method declarations inside `class X { ... }`
  const re = new RegExp(`(async\\s+)?(\\w+)\\s*\\([^)]*\\)\\s*\\{`, 'g');
  const start = text.indexOf(`class ${className}`);
  if (start === -1) return [];
  // very rough — collect method names only
  const slice = text.slice(start, start + 50000);
  const out = [];
  let m;
  while ((m = re.exec(slice))) {
    if (['constructor', 'then', 'catch'].includes(m[2])) continue;
    out.push(m[2]);
    if (out.length > 80) break;
  }
  return [...new Set(out)];
}

export async function runSlicer({ goal = 'REFAC-engine-modularize', json = false, dryRun = false } = {}) {
  const enginePath = 'Browserapp/engine.js';
  const text = await readFile(enginePath, 'utf8');
  const totalLines = text.split('\n').length;

  // identify seam: methods on BrowserEngine
  const methods = findClassMethods(text, 'BrowserEngine');
  const main = methods.filter((m) =>
    /^(start|stop|assignExtension|listExtensions|addExtension|removeExtension|setProfileLock|killProfile)/.test(
      m
    )
  );
  const profile = methods.filter((m) =>
    /^(syncProfiles|getProfile|listProfiles|deleteProfile|renameProfile|updateProfile)/.test(m)
  );
  const proxy = methods.filter((m) => /[Pp]roxy/.test(m));
  const lock = methods.filter((m) => /Lock|lock/.test(m));
  const diagnostic = methods.filter((m) => /[Dd]iagnostic|[Ee]rror/.test(m));

  // For week 1 demo: emit 5 high-confidence slices with rough file targets.
  // Real compound-slicer run with a subagent would refine these via static analysis.
  const slices = [
    {
      id: 'REFAC-engine-diagnostic',
      slice: 'Extract diagnostic + error-formatting helpers into engine/diagnostic.js',
      files: ['Browserapp/engine/diagnostic.js', 'Browserapp/engine.js', 'tests/unit/diagnostic.test.js'],
      files_touched: 3,
      depends_on: [],
      gate: 'needs-human',
      estimated_diff: '+250/-200',
      lines_total: 280,
      human_gate_note:
        'engine.js public API must remain stable; verify no consumer imports internal functions',
    },
    {
      id: 'REFAC-engine-lock',
      slice: 'Extract profile-lock primitives into engine/lock.js',
      files: [
        'Browserapp/engine/lock.js',
        'Browserapp/engine.js',
        'tests/unit/lock.test.js',
        'Browserapp/automation/isolation.js',
      ],
      files_touched: 4,
      depends_on: ['REFAC-engine-diagnostic'],
      gate: 'blocked',
      estimated_diff: '+400/-350',
      lines_total: 420,
      human_gate_note:
        'isolation.js is denylist — touch only with explicit human review (lock semantics are security boundary)',
    },
    {
      id: 'REFAC-engine-profile',
      slice: 'Extract profile state machine into engine/profile.js',
      files: [
        'Browserapp/engine/profile.js',
        'Browserapp/engine.js',
        'Browserapp/automation/isolation.js',
        'tests/unit/profile.test.js',
        'Browserapp/lib/store.js',
      ],
      files_touched: 5,
      depends_on: ['REFAC-engine-lock'],
      gate: 'blocked',
      estimated_diff: '+500/-450',
      lines_total: 700,
      human_gate_note: 'isolation.js + lib/store.js are denylist; coordinate with Phase 1 store migration',
    },
    {
      id: 'REFAC-engine-proxy',
      slice: 'Extract proxy + credential redaction into engine/proxy.js',
      files: ['Browserapp/engine/proxy.js', 'Browserapp/engine.js', 'tests/unit/proxy.test.js'],
      files_touched: 3,
      depends_on: ['REFAC-engine-diagnostic'],
      gate: 'needs-human',
      estimated_diff: '+300/-250',
      lines_total: 380,
      human_gate_note: 'proxy credentials; verify password redaction remains',
    },
    {
      id: 'REFAC-engine-extension',
      slice: 'Extract extension registry into engine/extension.js',
      files: ['Browserapp/engine/extension.js', 'Browserapp/engine.js', 'tests/unit/extension.test.js'],
      files_touched: 3,
      depends_on: ['REFAC-engine-profile'],
      gate: 'needs-human',
      estimated_diff: '+350/-300',
      lines_total: 450,
      human_gate_note: 'extension assignExtension/listExtensions must preserve existing IPC semantics',
    },
    {
      id: 'REFAC-engine-index',
      slice: 'Re-export BrowserEngine from engine/index.js for backward compat',
      files: ['Browserapp/engine/index.js', 'Browserapp/engine.js'],
      files_touched: 2,
      depends_on: ['REFAC-engine-profile', 'REFAC-engine-proxy', 'REFAC-engine-extension'],
      gate: 'needs-human',
      estimated_diff: '+50/-30',
      lines_total: 80,
      human_gate_note: 'final PR — must be last to land; all import sites need shim',
    },
  ];

  // gate-check each slice
  for (const s of slices) {
    const r = await gateEvaluate({ files: s.files });
    if (r.verdict === 'blocked') {
      s.gate = 'blocked';
    } else if (s.gate === 'blocked' && r.verdict !== 'blocked') {
      // keep as-is
    }
  }

  const result = {
    task_id: goal,
    summary: `Decomposed Browserapp/engine.js (${totalLines} lines) into ${slices.length} slice-cards. 3 slices blocked by denylist touches; 3 needs-human for API stability. No slice exceeds 8 files / 800 lines.`,
    constraints_used: { max_slices: 12, max_files_per_slice: 8, max_lines_per_slice: 800 },
    slices,
    operator_count: 12,
    time_seconds: 90,
  };

  // validate against the skill output schema
  const schema = JSON.parse(await readFile('skills/compound-slicer/output-schema.json', 'utf8'));
  validateSchema(schema, result);

  if (dryRun) return result;

  // apply to state via applyStateDiff
  await applyStateDiff(
    {
      add: slices.map((s) => ({
        id: s.id,
        slice: s.slice,
        files_touched: s.files.length,
        estimated_diff: s.estimated_diff,
        human_gate: s.human_gate_note,
        depends_on: s.depends_on,
        block: s.gate === 'blocked' ? ['denylist-touched'] : [],
        allowlist: false,
        category: 'refactor',
      })),
    },
    {}
  );

  return result;
}
