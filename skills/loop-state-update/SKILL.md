---
name: loop-state-update
description: Atomically apply a diff (add/update/remove) to state/current.json and re-render STATE.md. Use after any loop run that mutates the work queue. Idempotent on item id; uses a file-based lock to prevent concurrent writes.
---

# loop-state-update

Three operations: `add`, `update`, `remove`. Each takes a list of items.

- `add`: appends to `high_priority`; rejects if `id` already exists (idempotent)
- `update`: replaces fields on the matching `id`; rejects if `id` does not exist
- `remove`: pops the `id` from `high_priority`; silently no-ops if missing

Always:
1. Acquire `docs/loop-engineering/state.lock` (file-based, flock)
2. Read `state/current.json`
3. Validate proposed changes against `state/schema.json`
4. Apply
5. Re-render `STATE.md` from JSON
6. Release lock
7. Append summary to `loop-run-log.md`

## When to invoke

- After `loop-triage` produces a triage JSON
- After `compound-slicer` emits slice-cards
- After any PR is merged (move from `high_priority` to `done`)
- After any kill-switch trigger (set `paused_patterns`)

## Input contract

- `add`: array of `{ id, slice, files_touched, depends_on, ... }` per schema
- `update`: array of `{ id, ...fields to replace }`
- `remove`: array of `id` strings
- `render_state_md`: bool (default true)

## Output contract

See `output-schema.json`. `applied` is the count of successfully applied items. `conflicts` lists any items that could not be applied (already exists for add, missing for update).

## Anti-patterns to avoid

- Do not edit STATE.md by hand; always go through this skill.
- Do not skip schema validation.
- Do not release the lock before STATE.md is re-rendered.
- Do not allow two updates to run concurrently (lock is mandatory).
