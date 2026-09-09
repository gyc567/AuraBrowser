# Loop Engineering

AuraBrowser uses [loop-engineering](https://github.com/cobusgreyling/loop-engineering) as its self-evolution framework: the system discovers work, hands it to agents, verifies results, and persists state — instead of typing the next prompt by hand.

This directory is the **state and policy** layer. The **runtime** lives in `tools/loop-cli/`. The **skills** that loops invoke live in `skills/loop-*/` and `skills/compound-*/`.

## Five-minute tour

```bash
# 1. First-time scaffold (week 1 already done — this is for future maintainers)
npx @aura/loop init . --pattern compound-slicer --tool dsh

# 2. Health check: schema, lint, tests, gate consistency
npx @aura/loop doctor .

# 3. Current state, machine-readable
npx @aura/loop status . --json

# 4. Reconcile STATE.md against git history
npx @aura/loop reconcile .

# 5. Compute Loop Readiness Score
npx @aura/loop audit .
```

## Directory layout

```
docs/loop-engineering/
├── README.md              <- you are here
├── STATE.md               <- next-work queue (human-readable)
├── loop-budget.md         <- per-pattern operator + time caps
├── loop-run-log.md        <- append-only run history
├── denylist-reasons.md    <- per-path rationale for gate.yaml
└── state/
    ├── schema.json        <- JSON Schema for STATE.md
    ├── current.json       <- machine-readable mirror of STATE.md
    └── history/           <- one JSON snapshot per run
```

```
config/loop/
├── registry.yaml          <- 8 upstream patterns
├── compound.yaml          <- 2 aura-specific compound patterns
└── gate.yaml              <- denylist + compound rules + allowlist + limits
```

```
tools/loop-cli/            <- @aura/loop CLI runtime (week 1: 5 commands)
skills/loop-*/             <- 8 skill definitions (each w/ output-schema.json)
skills/compound-*/         <- aura-specific compound skills
.github/workflows/         <- thin-loop daily triage runner
```

## Patterns active in week 1

- **L1 report-only**: `daily-triage`, `pr-babysitter`
- **L0 dormant**: `thin-loop`, `ci-sweeper`, `post-merge-cleanup`, `dependency-sweeper`, `changelog-drafter`, `issue-triage`
- **L2 ready**: `compound-slicer`, `compound-verifier` (activate when first slice-card is needed)

## Readiness model

| Level | Description | What's required |
|-------|-------------|-----------------|
| **L0** | Draft | Documented intent only |
| **L1** | Report | Triage → state, no auto-action |
| **L2** | Assisted | Small auto-fixes with verifier + gate |
| **L3** | Unattended | All checklist sections + audit pass |

**Current retro-level**: L1 (Phase 0+1 commits, manual). After LE-1..LE-3 the framework reaches forward L1; L2 unlocks after at least 3 successful compound-verifier runs.

## Anti-patterns explicitly avoided

1. **Same agent implements and verifies** → enforced via `compound-verifier` using `subagent` (not fork) with default REJECT stance.
2. **No attempt cap** → `loop-budget.md` per-item cap of 3 attempts; KILL switch after 3 fails on same PR.
3. **Vague triage output** → every skill has `output-schema.json`; STATE.md entries must validate.
4. **L3 before L1 quality** → week 1 is report-only.
5. **No state file** → `state/current.json` mirrors STATE.md; reconcile on every run.
6. **No kill switch** → 6 trigger conditions in `loop-budget.md` Kill Switch section.
7. **No run log** → `loop-run-log.md` append-only with structure hash.

## Further reading

- `docs/loop-engineering/STATE.md` — current work queue
- `docs/loop-engineering/loop-budget.md` — caps and kill switch
- `docs/loop-engineering/denylist-reasons.md` — why each path is human-only
- `config/loop/registry.yaml` — pattern catalog
- `config/loop/gate.yaml` — gate rules
- `tools/loop-cli/` — CLI runtime
- `skills/loop-*/SKILL.md` — skill contracts
- `skills/loop-*/output-schema.json` — skill output schemas
- [Upstream: loop-engineering](https://github.com/cobusgreyling/loop-engineering)
