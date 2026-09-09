# @aura/loop

Loop Engineering CLI for AuraBrowser. Self-evolution framework runtime.

## Installation

This is a private workspace package (`tools/loop-cli/`). The CLI is invoked as `node tools/loop-cli/bin/loop.js <cmd>`. After workspace install, `npx @aura/loop <cmd>` also works.

## Commands

### `loop init . [--pattern X] [--tool Y] [--force]`

Scaffold the framework files. Idempotent. Reports `created` vs `skipped`.

### `loop doctor .`

Run 18 health checks:
- 8 file presence checks
- 1 schema validity check on `state/current.json`
- 3 YAML parse checks
- 2 gate self-evaluation checks
- 1 git HEAD readability check

Exits non-zero if any check fails.

### `loop status . [--json]`

Print current state from `state/current.json` (or `--json` for the full object).

### `loop audit . [--json]`

Compute Loop Readiness Score per `docs/loop-engineering/README.md`. 10 sections, +10 pts each, 100 = L3. Updates `state.current.json` with the new `last_audit_run` and `last_audit_score`.

### `loop reconcile . [--json]`

Three-way reconciliation:
- `state/current.json` schema validity
- `state.done[].commits` vs `git log` (untracked commits detection)
- `loop-run-log.md` entry count vs `state.total_runs`

### `loop cost --pattern X [--proposed-operators N] [--proposed-time-seconds T] [--json]`

Compare proposed run cost to per-pattern cap from `registry.yaml` or `compound.yaml`. Returns `cap_status`: `under` | `near` | `over` | `kill`.

## Library API

The lib modules are re-exported from `./src/index.js`:

```js
import {
  readYamlFile, parseYaml,             // YAML
  validateSchema, isValid, SchemaError, // JSON Schema
  withLock, acquire, release,            // file lock
  loadState, saveState, applyStateDiff,  // state
  recordOperator, countOperators,        // operator log
  evaluate as gateEvaluate,              // gate
} from '@aura/loop';
```

## Architecture

```
tools/loop-cli/
├── bin/loop.js          CLI dispatch
├── src/
│   ├── index.js         library re-exports
│   ├── init.js          init command
│   ├── doctor.js        doctor command
│   ├── status.js        status command
│   ├── audit.js         audit command
│   ├── reconcile.js     reconcile command
│   ├── cost.js          cost command
│   ├── adapters/dsh.js  DSH adapter (week 1: stub)
│   └── lib/             shared modules (yaml, schema, lock, state, operator, gate)
└── package.json
```

## Week 1 status

- [x] YAML parser (handles 2-space indent + lists)
- [x] JSON Schema validator (subset of draft-07)
- [x] File-based advisory lock (reentrant + stale detection)
- [x] State load/save/diff/render
- [x] Operator log writer
- [x] Gate evaluator (denylist + 5 compound rules + allowlist + limits)
- [x] 5 commands: init, doctor, status, audit, reconcile
- [x] cost command (stub for week 2)
- [x] DSH adapter (stub for week 2)

## Week 2 plan

- [ ] DSH adapter: real `cordis_*` bridge
- [ ] `run` command: dispatch to compound-* or upstream patterns
- [ ] Hook `state/current.json` mutations to a `loop-run-log.md` append
- [ ] JSONL operator log auto-write from DSH tool calls
- [ ] First end-to-end `compound-slicer` invocation
