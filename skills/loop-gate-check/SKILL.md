---
name: loop-gate-check
description: Evaluate a proposed diff against config/loop/gate.yaml and return a structured verdict: auto-merge, needs-human, or blocked. Use before any auto-merge decision and after every compound-slicer slice is implemented.
---

# loop-gate-check

Evaluation order (per `gate.yaml` `evaluation_order`):
1. `denylist_match` — any denylist path touched → `blocked`
2. `compound_rules` — check 5 rules (test_changes_denied, doc_covers_denied, ci_workflow_change, loop_self_change, state_drift) → may upgrade or require reviewers
3. `allowlist_match` — all paths in allowlist → `auto-merge`
4. `fallback_human` — anything else → `needs-human`

Also enforces `limits`:
- `max_files_per_PR: 8`
- `max_lines_per_file: 600`
- `max_lines_per_PR: 1500`
- `max_attempts_per_item: 3`

## When to invoke

- Before any PR is opened (CI gate)
- After every `compound-slicer` slice is implemented
- After `loop-minimal-fix` produces a candidate diff
- In `loop-pr-babysit` before returning `merge` as `next_action`

## Input contract

- `files`: list of paths being changed
- `lines_per_file`: `{ path: int }` (optional, for limits check)
- `pr_attempts`: int (default 1; checked against `max_attempts_per_item`)

## Output contract

See `output-schema.json`. `verdict` must be one of:
- `auto-merge`: all checks pass; safe to merge
- `needs-human`: not denylist, not allowlist, mixed; needs human review
- `blocked`: denylist touched or limit exceeded; do not merge

`matches.denylist`, `matches.compound`, `matches.allowlist` list the matched path/rule for transparency.

## Anti-patterns to avoid

- Do not skip the compound-rules step (it catches tests that import denylist paths).
- Do not let a `blocked` verdict be overridden without an explicit human decision recorded in `loop-run-log.md`.
- Do not exceed `max_files_per_PR` even if all paths are allowlist.
