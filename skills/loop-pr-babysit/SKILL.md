---
name: loop-pr-babysit
description: Monitor a GitHub PR through review, CI, rebase, and merge. Use when a PR has been opened and a loop is responsible for keeping it moving. Reports status and next action; never auto-merges denylist-touched PRs.
---

# loop-pr-babysit

Operates on a single PR at a time. Inspects:
- Review status (approved / changes requested / pending)
- CI status (success / failure / pending)
- Merge state (clean / conflicts / behind)
- Gate verdict (from `loop-gate-check`)

## When to invoke

- After opening a PR
- Every 5-15 min until merged or closed
- After any review comment or CI update

## Input contract

- `pr_number`: integer
- `repo`: `owner/name` (default: `gyc567/AuraBrowser`)

## Output contract

See `output-schema.json`. `next_action` must be one of:
- `wait`: no action needed, recheck in N minutes
- `rebase`: PR is behind main; rebase and push
- `fix-ci`: CI failed; run `loop-ci-sweeper` to triage
- `address-review`: review requested changes; run `loop-minimal-fix`
- `request-human`: gate verdict is `blocked` or `needs-human`; ping human
- `merge`: PR is approved, CI green, gate verdict `auto-merge`; merge with squash

## Anti-patterns to avoid

- Do not `merge` if gate verdict is anything other than `auto-merge`.
- Do not bypass review approval even if CI is green.
- Do not retry `fix-ci` more than 3 times in the same PR lifecycle.
- Do not let one PR babysit session run > 15 min (per `pr-babysitter` time cap).
