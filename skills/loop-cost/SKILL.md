---
name: loop-cost
description: Estimate the cost (operator count + wall time) of a proposed loop run. Use before starting any non-trivial pattern to verify the run is within budget. Output compares proposed to per-pattern cap.
---

# loop-cost

Reads:
- `config/loop/registry.yaml` or `compound.yaml` for per-pattern caps
- `docs/loop-engineering/state/operators-*.jsonl` for prior runs of the same pattern
- `docs/loop-engineering/loop-run-log.md` for run duration history

Returns a comparison of the proposed run to the per-pattern cap and the daily cap.

## When to invoke

- Before invoking `loop run` for any pattern with `token_cost: high` or `very-high`
- After a run to record actual cost (called automatically by CLI)

## Input contract

- `pattern_id`: one of the registered pattern ids
- `proposed_operators`: estimated tool calls
- `proposed_time_seconds`: estimated wall time

## Output contract

See `output-schema.json`. `cap_status`:
- `under`: well under cap (< 50% of cap)
- `near`: between 50% and 100% of cap
- `over`: exceeds cap (caller should escalate or split)
- `kill`: would trigger kill switch

## Anti-patterns to avoid

- Do not skip calling this for `very-high` cost patterns.
- Do not let a single run exceed 2× its per-pattern cap.
- Do not run if `cap_status` is `over` or `kill` without explicit human override.
