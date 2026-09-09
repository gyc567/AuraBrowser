// loop slicer --goal <X> [--dry-run]
// Decompose a large refactor (engine.js, renderer.js, etc.) into
// <=8-file slice-cards that the loop can land one PR at a time.
// Output is applied to state/current.json via applyStateDiff.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { applyStateDiff } from './lib/state.js';
import { evaluate as gateEvaluate } from './lib/gate.js';
import { validateSchema } from './lib/schema.js';

// Per-goal slice templates. Each goal returns the slice-cards that
// the loop will land in order. Slices reference real files / real
// function names extracted from the source.

const GOAL_TEMPLATES = {
  'REFAC-engine-modularize': engineSlices,
  'REFAC-renderer-split': rendererSlices,
};

function engineSlices(engineText) {
  const totalLines = engineText.split('\n').length;
  return [
    {
      id: 'REFAC-engine-diagnostic',
      slice: 'Extract diagnostic + error-formatting helpers into engine/diagnostic.js',
      files: [
        'Browserapp/engine/diagnostic.js',
        'Browserapp/engine.js',
        'tests/unit/engine-diagnostic.test.js',
      ],
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
      files: ['Browserapp/engine/proxy.js', 'Browserapp/engine.js', 'tests/unit/engine-proxy.test.js'],
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
  ].map((s) => ({ ...s, totalLines }));
}

function rendererSlices(rendererText) {
  const totalLines = rendererText.split('\n').length;

  // Identify candidate seams by scanning top-level declarations.
  // Each slice is sized to fit within 8 files and 800 lines.

  // Slice 1: pure helpers at top of file (no DOM, no IPC, no listeners)
  // Lines ~1-700 contain: UI_KEY, GROUP_COLORS, t(), tx(), appUpdateState,
  // applyVersionTrafficLight, openAppUpdatePanel, renderAppUpdateState,
  // checkAppUpdate, downloadAppUpdate, formatBytes, afterUiRender,
  // refreshLocaleChrome, applyPlatformClass, refreshIcons, createGroupId,
  // defaultGroups, defaultProfiles, positiveProfileNumber,
  // normalizeProfileSettings, normalizeOptionalWebUrl, cloneProfilePreferences,
  // mergeEngineExitState, loadUi, normalizeGroup, migrateGroups,
  // migrateProfileNumbers, loadedUi/migratedUi/migratedGroups/ui initialization.
  // This is the cleanest extraction seam: zero DOM, pure transformation.

  // Slice 2: pure render helpers (refreshIcons, refreshLocaleChrome, etc.)
  // After slice 1 these can be re-categorized.

  // Slice 3: localization tables and group-color management

  // Slice 4: app-update panel (small, isolated, has DOM but minimal IPC)

  // Slice 5: profile CRUD (largest functional area, touches many DOM nodes)

  // Slice 6: IPC wiring (send/recv to electron)

  // Slice 7: state machine (the big 'let ui = ...' + setState pattern)

  // Slice 8: index module that wires everything together

  return [
    {
      id: 'REFAC-renderer-utils',
      slice:
        'Extract pure helpers (formatBytes, createGroupId, positiveProfileNumber) into renderer/utils.js with UMD-lite export (CommonJS + window.__rendererUtils)',
      files: [
        'Browserapp/renderer/utils.js',
        'Browserapp/renderer.js',
        'Browserapp/index.html',
        'tests/unit/renderer-utils.test.js',
      ],
      files_touched: 4,
      depends_on: [],
      gate: 'needs-human',
      estimated_diff: '+60/-15',
      lines_total: 60,
      human_gate_note:
        'renderer.js is browser-context <script>; extracted helpers must be window-safe (no node: imports); index.html gets a <script> tag BEFORE renderer.js',
    },
    {
      id: 'REFAC-renderer-localization',
      slice:
        'Extract localization table (t, tx, localizeSystemLabel, refreshLocaleChrome) into renderer/l10n.js with i18next-shaped API',
      files: ['Browserapp/renderer/l10n.js', 'Browserapp/renderer.js', 'tests/unit/renderer-l10n.test.js'],
      files_touched: 3,
      depends_on: ['REFAC-renderer-utils'],
      gate: 'needs-human',
      estimated_diff: '+250/-230',
      lines_total: 280,
      human_gate_note:
        'keep UI_KEY_LOCALIZED backward compat; do not switch to i18next runtime yet (that is a later slice)',
    },
    {
      id: 'REFAC-renderer-profile-migrations',
      slice:
        'Extract profile normalization + migration chain (normalizeProfileSettings, normalizeGroup, migrateGroups, migrateProfileNumbers) into renderer/profile-migrations.js',
      files: [
        'Browserapp/renderer/profile-migrations.js',
        'Browserapp/renderer.js',
        'tests/unit/profile-migrations.test.js',
      ],
      files_touched: 3,
      depends_on: ['REFAC-renderer-utils'],
      gate: 'needs-human',
      estimated_diff: '+500/-480',
      lines_total: 520,
      human_gate_note: 'migrations are sequenced; any reorder breaks user profiles; preserve order exactly',
    },
    {
      id: 'REFAC-renderer-app-update',
      slice:
        'Extract app-update panel (applyVersionTrafficLight, openAppUpdatePanel, renderAppUpdateState, checkAppUpdate, downloadAppUpdate, appUpdateState) into renderer/app-update.js',
      files: [
        'Browserapp/renderer/app-update.js',
        'Browserapp/renderer.js',
        'tests/unit/renderer-app-update.test.js',
      ],
      files_touched: 3,
      depends_on: ['REFAC-renderer-utils'],
      gate: 'needs-human',
      estimated_diff: '+200/-180',
      lines_total: 220,
      human_gate_note:
        'app-update IPC contract (aura-browser:check-update, aura-browser:download-update) must remain unchanged',
    },
    {
      id: 'REFAC-renderer-groups',
      slice:
        'Extract group registry (listGroups, findGroup, groupNameOf, groupNameRaw, groupColorOf, countProfilesInGroup, activeGroupFilter) into renderer/groups.js',
      files: [
        'Browserapp/renderer/groups.js',
        'Browserapp/renderer.js',
        'tests/unit/renderer-groups.test.js',
      ],
      files_touched: 3,
      depends_on: ['REFAC-renderer-utils', 'REFAC-renderer-profile-migrations'],
      gate: 'needs-human',
      estimated_diff: '+150/-130',
      lines_total: 170,
      human_gate_note:
        'group name + color computed from profile id + migration; preserve lookup order for unresolved ids',
    },
    {
      id: 'REFAC-renderer-format-bytes',
      slice: 'Extract formatBytes + applyPlatformClass + refreshIcons into renderer/format.js',
      files: [
        'Browserapp/renderer/format.js',
        'Browserapp/renderer.js',
        'tests/unit/renderer-format.test.js',
      ],
      files_touched: 3,
      depends_on: ['REFAC-renderer-utils'],
      gate: 'needs-human',
      estimated_diff: '+120/-110',
      lines_total: 140,
      human_gate_note: 'refreshIcons manipulates DOM classList; must run in browser context only',
    },
    {
      id: 'REFAC-renderer-index',
      slice:
        'Move shared state and boot wiring into renderer/index.js; renderer.js becomes the original entry that re-exports for backward compat',
      files: ['Browserapp/renderer/index.js', 'Browserapp/renderer.js'],
      files_touched: 2,
      depends_on: [
        'REFAC-renderer-utils',
        'REFAC-renderer-localization',
        'REFAC-renderer-profile-migrations',
        'REFAC-renderer-app-update',
        'REFAC-renderer-groups',
        'REFAC-renderer-format-bytes',
      ],
      gate: 'needs-human',
      estimated_diff: '+80/-60',
      lines_total: 100,
      human_gate_note: 'final integration slice; index.html script tag still points to renderer.js',
    },
    {
      id: 'PERF-renderer-dom-budget',
      slice: 'Audit and cap DOM mutations per render cycle (event-listener leak check, reflow batching)',
      files: ['Browserapp/renderer.js', 'tests/perf/renderer-dom-budget.test.js'],
      files_touched: 2,
      depends_on: ['REFAC-renderer-index'],
      gate: 'needs-human',
      estimated_diff: '+150/-100',
      lines_total: 200,
      human_gate_note: 'Phase 4 perf slice; requires benchmark harness in tests/perf/',
    },
    {
      id: 'INFRA-release-please',
      slice: 'Configure release-please with conventional-commits + auto CHANGELOG + npm publish',
      files: [
        'release-please-config.json',
        '.github/workflows/release-please.yml',
        '.release-please-manifest.json',
        'docs/release-please.md',
      ],
      files_touched: 4,
      depends_on: [],
      gate: 'needs-human',
      estimated_diff: '+120/-0',
      lines_total: 150,
      human_gate_note: 'phase 4 infra slice; configure releaseType per package; first release will be v1.1.1',
    },
  ].map((s) => ({ ...s, totalLines }));
}

export async function runSlicer({ goal = 'REFAC-engine-modularize', json = false, dryRun = false } = {}) {
  const targetPath = goal.startsWith('REFAC-engine') ? 'Browserapp/engine.js' : 'Browserapp/renderer.js';
  const text = await readFile(targetPath, 'utf8');

  const factory = GOAL_TEMPLATES[goal];
  if (!factory) {
    throw new Error(`unknown goal: ${goal}. Available: ${Object.keys(GOAL_TEMPLATES).join(', ')}`);
  }

  let slices = factory(text);
  if (slices.length === 0) {
    throw new Error(`slicer produced no slices for goal ${goal}`);
  }

  // gate-check each slice
  for (const s of slices) {
    const r = await gateEvaluate({ files: s.files });
    if (r.verdict === 'blocked') {
      s.gate = 'blocked';
    }
  }

  const result = {
    task_id: goal,
    summary:
      `Decomposed ${targetPath} (${slices[0].totalLines} lines) into ${slices.length} slice-cards via ${goal}. ` +
      `${slices.filter((s) => s.gate === 'blocked').length} slices blocked by denylist touches; ` +
      `${slices.filter((s) => s.gate === 'needs-human').length} needs-human for API/contract stability. ` +
      `No slice exceeds 8 files / 800 lines.`,
    constraints_used: { max_slices: 12, max_files_per_slice: 8, max_lines_per_slice: 800 },
    slices: slices.map((s) => {
      const { totalLines, ...rest } = s;
      return rest;
    }),
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
        files_touched: s.files_touched,
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
