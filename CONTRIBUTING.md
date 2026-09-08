# Contributing to OpenBrowser

Thank you for your interest in OpenBrowser. This document covers the day-to-day
process for landing a change.

## Repository layout

```
AuraBrowser/
├── Browserapp/             # Electron app source (CommonJS, single main entry)
│   ├── main.js             # Main process entry (IPC hub, lifecycle)
│   ├── renderer.js         # Renderer UI controller (Phase 3 will split this)
│   ├── engine.js           # Profile lifecycle + kernel launcher
│   ├── cdp.js              # Chrome DevTools Protocol client
│   ├── automation/         # Local API + MCP + RPA + cloud sync
│   ├── scripts/            # Build / package / kernel helpers
│   └── lib/                # Shared utilities (log, store, errors) — Phase 1+
├── tests/                  # Node:test unit + integration suites (Phase 1+)
├── packages/               # Future shared packages (Phase 2+)
├── docs/                   # Architecture / process docs
└── .github/workflows/      # CI pipelines
```

## Development setup

```bash
# One-time: install pnpm (Corepack is the recommended way)
corepack enable
corepack prepare pnpm@10.34.5 --activate

# Install dependencies
pnpm install

# Run lint (must pass before commit; pre-commit hook enforces)
pnpm lint

# Run all tests
pnpm test

# Run the app (development)
cd Browserapp && pnpm start
```

## Commit messages — Conventional Commits (mandatory)

We use [Conventional Commits](https://www.conventionalcommits.org/) enforced
by `commitlint` in the pre-commit hook. Format:

```
<type>(<scope>): <subject>

<body — explain WHY, not WHAT>

<footer — references to issues, BREAKING CHANGE markers>
```

### Allowed types

| Type | When | Bumps version |
|------|------|---------------|
| `feat` | New user-visible feature | minor (1.1.0 → 1.2.0) |
| `fix` | Bug fix | patch (1.1.0 → 1.1.1) |
| `perf` | Performance improvement | patch |
| `refactor` | Code change without behavior change | — |
| `docs` | Documentation only | — |
| `test` | Adding or correcting tests | — |
| `build` | Build system / dependencies | — |
| `ci` | CI configuration | — |
| `chore` | Maintenance (non-src) | — |
| `security` | Security fix | patch |
| `revert` | Revert a previous commit | — |

### Scope (optional but recommended)

Use lowercase module name: `automation`, `mcp`, `renderer`, `engine`, `i18n`,
`fingerprint`, `cloud`, `build`, `ci`. Subject ≤ 100 chars, no trailing period.

### Examples

```
feat(rpa): add screenshot variable extraction to evaluate step

The screenshot step now stores its file path in `result.screenshot` so
downstream steps can attach it to a webhook payload.

Closes #42
```

```
security(cors): restrict default origin allowlist to loopback only
```

```
fix(engine): recover profile lock when chromium helper outlives app

BREAKING CHANGE: profile lock file format changed. Existing locks from
v1.0.x are no longer recognized and must be cleared manually.
```

## Pull request process

1. Create a feature branch from `main`: `git checkout -b feat/short-name`
2. Make changes, commit with conventional commit format
3. Push and open a PR against `main`
4. Fill in the PR template (auto-loaded)
5. Wait for CI green: lint + test + CodeQL
6. Request a review

### PR checklist (from template)

- [ ] Tests added/updated for behavior changes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] No new console.log in main process (use `lib/log.js`)
- [ ] If security-related: documented in `docs/security/`
- [ ] If changes IPC: extended `assertTrustedIpcSender` tests
- [ ] If changes persistence: data migration script in `scripts/migrate/`

## Coding standards

- **Style**: 2-space indent, single quotes, semicolons required, LF line endings
  (enforced by Prettier + ESLint; pre-commit auto-fixes staged files)
- **No `console.log`** in main process — use `lib/log.js` (the one exception
  is console output for CLI tools like `selftest.js` which run standalone)
- **No `var`** — use `const` / `let`
- **Triple-equals** for equality (`==` only allowed against `null`)
- **JSDoc** on every exported function from `lib/`, `engine/`, `automation/`
- **No circular requires** between top-level modules — use `lib/events.js` bus
- **Sensitive fields** in logs / API responses — never raw; use `lib/log.js redact()`
  or strip before responding

## Testing

- Unit tests: `tests/unit/**/*.test.js`
- Integration tests: `tests/integration/**/*.test.js` (need live main process)
- Coverage target: ≥ 60% lines, ≥ 50% branches for `lib/`, `engine/`, `automation/`
- Run a single file: `node --test tests/unit/foo.test.js`
- Watch mode: not built yet (Phase 1 will add)

## Issue reporting

Use the bug / feature templates. Include:
- OpenBrowser version (`app → About`)
- OS + arch
- Steps to reproduce
- Expected vs actual behavior
- Relevant log entries from `~/Library/Application Support/openbrowser/logs/`
  (macOS) / `%APPDATA%/openbrowser/logs/` (Windows) / `~/.config/openbrowser/logs/` (Linux)

## Security disclosures

Please **do not** file public issues for suspected vulnerabilities. Email
security@openbrowser.local with a description and reproduction steps.
We aim to acknowledge within 3 business days.

## License

By contributing, you agree that your contributions will be licensed under
the MIT License (see [LICENSE](./LICENSE)).
