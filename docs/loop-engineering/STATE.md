# AuraBrowser STATE

> Loop Engineering state file. Schema: state/schema.json
> Source of truth: state/current.json (machine-readable mirror)
> Last reconcile: 2026-09-09T08:35:14.545Z

## High Priority (next PR slot)

- [ ] **REFAC-engine-diagnostic**: Extract diagnostic + error-formatting helpers into engine/diagnostic.js
  - slice: Extract diagnostic + error-formatting helpers into engine/diagnostic.js
  - files-touched: 3
  - estimated-diff: +250/-200
  - human-gate: engine.js public API must remain stable; verify no consumer imports internal functions

- [ ] **REFAC-engine-lock**: Extract profile-lock primitives into engine/lock.js
  - slice: Extract profile-lock primitives into engine/lock.js
  - files-touched: 4
  - estimated-diff: +400/-350
  - human-gate: isolation.js is denylist — touch only with explicit human review (lock semantics are security boundary)
  - depends-on: [REFAC-engine-diagnostic]
  - block: [denylist-touched]

- [ ] **REFAC-engine-profile**: Extract profile state machine into engine/profile.js
  - slice: Extract profile state machine into engine/profile.js
  - files-touched: 5
  - estimated-diff: +500/-450
  - human-gate: isolation.js + lib/store.js are denylist; coordinate with Phase 1 store migration
  - depends-on: [REFAC-engine-lock]
  - block: [denylist-touched]

- [ ] **REFAC-engine-proxy**: Extract proxy + credential redaction into engine/proxy.js
  - slice: Extract proxy + credential redaction into engine/proxy.js
  - files-touched: 3
  - estimated-diff: +300/-250
  - human-gate: proxy credentials; verify password redaction remains
  - depends-on: [REFAC-engine-diagnostic]

- [ ] **REFAC-engine-extension**: Extract extension registry into engine/extension.js
  - slice: Extract extension registry into engine/extension.js
  - files-touched: 3
  - estimated-diff: +350/-300
  - human-gate: extension assignExtension/listExtensions must preserve existing IPC semantics
  - depends-on: [REFAC-engine-profile]

- [ ] **REFAC-engine-index**: Re-export BrowserEngine from engine/index.js for backward compat
  - slice: Re-export BrowserEngine from engine/index.js for backward compat
  - files-touched: 2
  - estimated-diff: +50/-30
  - human-gate: final PR — must be last to land; all import sites need shim
  - depends-on: [REFAC-engine-profile, REFAC-engine-proxy, REFAC-engine-extension]

## Watch (this week)

- lib/ coverage: 93.89% lines / 77.02% branches
- 70+ standalone *-selftest.js — slow migration to node:test (26 cases so far)
- Phase 2 (engine.js 拆 8 modules) — no slice-cards yet
- Phase 3 (renderer.js 6053 lines 拆 + Preact + i18n) — no slice-cards yet
- Phase 4 (performance + release-please) — schema TBD

## Done (recent 30d, max 50)

- 2026-09-09 PHASE-1: errors + store + c8 coverage + docs (f3418fe, f5d40b9, cf171b3, 40e05f7)
- 2026-09-08 PHASE-0: build + log + security + docs (579ed33, f8a9717, 5e37f26, a9bc481)
- 2026-09-09 ci(loop): add daily-triage workflow (L1 report, no auto-merge) (3a3351e)
- 2026-09-09 feat(loop): @aura/loop CLI runtime with 6 working commands (267bd83)
- 2026-09-09 chore(loop): scaffold loop-engineering framework (a27e8bd)

## Loop Metadata

- last_triage_run: 2026-09-09T08:33:33.602Z
- last_audit_run: 2026-09-09T08:35:16.837Z
- last_reconcile_run: 2026-09-09T08:35:14.545Z
- last_audit_score: L3
- active_patterns: [daily-triage, pr-babysitter, post-merge-cleanup, compound-slicer, compound-verifier]
- paused_patterns: []
- total_runs: 1
- operator_count_today: 0
- operator_count_total: 0
- time_spent_today_seconds: 0
- time_spent_total_seconds: 0
- schema_version: 1
- schema_validated_at: 2026-09-09T00:49:07.781Z
