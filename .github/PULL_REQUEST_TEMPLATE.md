## Summary

<!-- One-paragraph description of what this PR changes and why. -->

## Type of change

<!-- Mark with [x]. One per line, multiple allowed. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds capability)
- [ ] Breaking change (existing behavior changes; document in description)
- [ ] Performance improvement
- [ ] Refactor (no behavior change)
- [ ] Documentation only
- [ ] CI / build / tooling

## Linked issues

<!-- Use `Closes #N` / `Fixes #N` / `Refs #N` -->

## Testing

<!-- How did you verify this works? -->

- [ ] Unit tests added/updated (`tests/unit/...`)
- [ ] Integration tests added/updated (`tests/integration/...`)
- [ ] Existing selftests still pass (`cd Browserapp && npm run selftest && npm run selftest:automation && npm run selftest:mcp`)
- [ ] Manual smoke test on local install

## Checklist

- [ ] Commit messages follow Conventional Commits (`pnpm exec commitlint --from main`)
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] No new `console.log` in `Browserapp/main.js` / `engine.js` / `automation/`
      (use `lib/log.js`)
- [ ] If IPC contract changed: extended `assertTrustedIpcSender` unit tests
- [ ] If persistence changed: `lib/store.js` migration path documented
- [ ] If security-relevant: documented in `docs/security/` and `CHANGELOG.md`
- [ ] Documentation updated (README / CONTRIBUTING / docs/...) where relevant

## Screenshots / recordings

<!-- If user-visible change: attach before / after screenshots. -->

## Breaking change notes

<!-- If marked above, describe:
  - What breaks?
  - Migration path for existing users?
  - Mention in CHANGELOG?
-->
