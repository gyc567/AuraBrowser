# AuraBrowser STATE

> Loop Engineering state file. Schema: state/schema.json
> Source of truth: state/current.json (machine-readable mirror)
> Last reconcile: 2026-09-09T10:07:16.728Z

## High Priority (next PR slot)

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

- [ ] **REFAC-renderer-localization**: Extract localization table (t, tx, localizeSystemLabel, refreshLocaleChrome) into renderer/l10n.js with i18next-shaped API
  - slice: Extract localization table (t, tx, localizeSystemLabel, refreshLocaleChrome) into renderer/l10n.js with i18next-shaped API
  - files-touched: 3
  - estimated-diff: +250/-230
  - human-gate: keep UI_KEY_LOCALIZED backward compat; do not switch to i18next runtime yet (that is a later slice)
  - depends-on: [REFAC-renderer-utils]

- [ ] **REFAC-renderer-profile-migrations**: Extract profile normalization + migration chain (normalizeProfileSettings, normalizeGroup, migrateGroups, migrateProfileNumbers) into renderer/profile-migrations.js
  - slice: Extract profile normalization + migration chain (normalizeProfileSettings, normalizeGroup, migrateGroups, migrateProfileNumbers) into renderer/profile-migrations.js
  - files-touched: 3
  - estimated-diff: +500/-480
  - human-gate: migrations are sequenced; any reorder breaks user profiles; preserve order exactly
  - depends-on: [REFAC-renderer-utils]

- [ ] **REFAC-renderer-app-update**: Extract app-update panel (applyVersionTrafficLight, openAppUpdatePanel, renderAppUpdateState, checkAppUpdate, downloadAppUpdate, appUpdateState) into renderer/app-update.js
  - slice: Extract app-update panel (applyVersionTrafficLight, openAppUpdatePanel, renderAppUpdateState, checkAppUpdate, downloadAppUpdate, appUpdateState) into renderer/app-update.js
  - files-touched: 3
  - estimated-diff: +200/-180
  - human-gate: app-update IPC contract (aura-browser:check-update, aura-browser:download-update) must remain unchanged
  - depends-on: [REFAC-renderer-utils]

- [ ] **REFAC-renderer-groups**: Extract group registry (listGroups, findGroup, groupNameOf, groupNameRaw, groupColorOf, countProfilesInGroup, activeGroupFilter) into renderer/groups.js
  - slice: Extract group registry (listGroups, findGroup, groupNameOf, groupNameRaw, groupColorOf, countProfilesInGroup, activeGroupFilter) into renderer/groups.js
  - files-touched: 3
  - estimated-diff: +150/-130
  - human-gate: group name + color computed from profile id + migration; preserve lookup order for unresolved ids
  - depends-on: [REFAC-renderer-utils, REFAC-renderer-profile-migrations]

- [ ] **REFAC-renderer-format-bytes**: Extract formatBytes + applyPlatformClass + refreshIcons into renderer/format.js
  - slice: Extract formatBytes + applyPlatformClass + refreshIcons into renderer/format.js
  - files-touched: 3
  - estimated-diff: +120/-110
  - human-gate: refreshIcons manipulates DOM classList; must run in browser context only
  - depends-on: [REFAC-renderer-utils]

- [ ] **REFAC-renderer-index**: Move shared state and boot wiring into renderer/index.js; renderer.js becomes the original entry that re-exports for backward compat
  - slice: Move shared state and boot wiring into renderer/index.js; renderer.js becomes the original entry that re-exports for backward compat
  - files-touched: 2
  - estimated-diff: +80/-60
  - human-gate: final integration slice; index.html script tag still points to renderer.js
  - depends-on: [REFAC-renderer-utils, REFAC-renderer-localization, REFAC-renderer-profile-migrations, REFAC-renderer-app-update, REFAC-renderer-groups, REFAC-renderer-format-bytes]

- [ ] **PERF-renderer-dom-budget**: Audit and cap DOM mutations per render cycle (event-listener leak check, reflow batching)
  - slice: Audit and cap DOM mutations per render cycle (event-listener leak check, reflow batching)
  - files-touched: 2
  - estimated-diff: +150/-100
  - human-gate: Phase 4 perf slice; requires benchmark harness in tests/perf/
  - depends-on: [REFAC-renderer-index]

- [ ] **INFRA-release-please**: Configure release-please with conventional-commits + auto CHANGELOG + npm publish
  - slice: Configure release-please with conventional-commits + auto CHANGELOG + npm publish
  - files-touched: 4
  - estimated-diff: +120/-0
  - human-gate: phase 4 infra slice; configure releaseType per package; first release will be v1.1.1

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
- 2026-09-09 chore(loop): adopt Phase 0+1 + loop framework commits into STATE (8628502)
- 2026-09-09 feat(loop): reconcile --adopt and --purge flags (6bfe04d)
- 2026-09-09 chore(loop): adopt reconcile --adopt and adopt-state commits (91afae8)
- 2026-09-09 style(loop): reformat STATE.md and current.json with Prettier (1530775)
- 2026-09-09 chore(loop): final adopt (loop framework now self-consistent) (9e15c96)
- 2026-09-09 refactor(engine): extract diagnostic helpers to engine/diagnostic.js (8cc29fc)
- 2026-09-09 chore(loop): adopt style commit (loop self-consistent) (8e8d0c6)
- 2026-09-09 refactor(engine): extract proxy helpers to engine/proxy.js (8f4e71c)
- 2026-09-09 feat(loop): first L2 slice complete (REFAC-engine-diagnostic) (b1aa609)
- 2026-09-09 refactor(renderer): extract pure helpers to renderer/utils.js (e0d309f)
- 2026-09-09 feat(loop): second L2 slice complete (REFAC-engine-proxy) (07c0c4d)

## Loop Metadata

- last_triage_run: 2026-09-09T08:33:33.602Z
- last_audit_run: 2026-09-09T09:25:08.091Z
- last_reconcile_run: 2026-09-09T10:07:16.728Z
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
