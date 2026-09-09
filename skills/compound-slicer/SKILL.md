---
name: compound-slicer
description: Decompose a large refactor task (e.g. Phase 2 engine split, Phase 3 renderer split) into N <=8-file slice-cards. Each slice has an id, target files, dependency edges, and a gate verdict. Use before any multi-file refactor that exceeds the per-PR file limit.
---

# compound-slicer

Reads a task description and scans the codebase to identify natural split points. Produces an ordered list of slice-cards.

## When to invoke

- Before Phase 2 (engine.js modularization)
- Before Phase 3 (renderer.js 6053-line split)
- Before any refactor > 8 files
- After `loop-triage` scores a refactor item ≥ 80

## Input contract

- `task_id`: e.g. `REFAC-engine-modularize`
- `task_description`: human prose
- `target_paths`: list of files to split
- `constraints`:
  - `max_slices`: default 12
  - `max_files_per_slice`: default 8
  - `max_lines_per_slice`: default 800

## Output contract

See `output-schema.json`. `slices` array of slice-cards. Each card:
- `id`: unique, matches `[A-Z]+-[a-z0-9-]+`
- `slice`: human title
- `files_touched`: list of file paths
- `depends_on`: list of other slice ids that must land first
- `gate`: one of `auto-merge | needs-human | blocked`
- `estimated_diff`: e.g. `+200/-50`
- `human_gate_note`: when `gate != auto-merge`, why

## Algorithm

1. Build a dependency graph of the target files (via import/require graph)
2. Identify natural seams: independent sub-trees with ≤ 8 files and ≤ 800 lines
3. Order slices by dependency: leaves first
4. Run `loop-gate-check` on each slice
5. For slices with `gate: blocked`, flag and bump `human_gate_note`
6. For slices with `gate: needs-human`, add review checklist

## Anti-patterns to avoid

- Do not produce a slice that touches > 8 files (would exceed `max_files_per_PR`).
- Do not produce circular dependencies between slices.
- Do not place a denylist path inside a slice without flagging `gate: blocked`.
- Do not exceed `max_slices: 12` for a single goal; if more, the goal itself is too large.
