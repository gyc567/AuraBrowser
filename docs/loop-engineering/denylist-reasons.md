# Denylist Reasons

Each denylisted path in `config/loop/gate.yaml` has a human-review gate. This document explains why.

## `Browserapp/main.js`

**Why denylisted**: Single Electron main process entry point (~2.5k lines). Holds:
- BrowserWindow lifecycle
- IPC handlers (trustedAppIndexUrl validation, assertTrustedIpcSender)
- `will-navigate`, `setWindowOpenHandler`, `will-attach-webview` security controls
- globalShortcut registration
- emit() event bus to all renderers

**Review burden**: Any change to a security handler (line ~1412, ~1419, ~1440) must be reviewed against the Phase 0 hardening.

**Override path**: human review + verify Phase 0 tests still pass (`pnpm test --test-name-pattern="cors|mcp-host-guard"`).

## `Browserapp/cdp.js`

**Why denylisted**: Chrome DevTools Protocol wrapper. Misuse = remote code execution inside renderer context.

**Override path**: human review + trace every new CDP method through a fingerprint/proxy/automation use case.

## `Browserapp/automation/mcp-server.js`

**Why denylisted**: MCP (Model Context Protocol) tool surface. Adding/removing/renaming tools changes the public API for any MCP client.

**Override path**: human review + bump `@cobusgreyling/loop`-style version note in `STATE.md` Watch.

## `Browserapp/automation/isolation.js`

**Why denylisted**: Anti-symlink, anti-escape, profile lock boundary. Security-critical.

**Override path**: human review + Phase 0 isolation selftest (`automation/isolation-fingerprint-selftest.js`).

## `Browserapp/automation/fingerprint.js`

**Why denylisted**: Anti-fingerprint logic. The `buildInjectionScript` template string (line 1345+) is injected into the browser context — any change runs inside the user's profile. Security boundary.

**Override path**: human review + selftest (`automation/fingerprint-selftest.js`).

## `Browserapp/lib/errors.js`

**Why denylisted**: AppError hierarchy shipped in Phase 1 (commit `f3418fe`). 30+ error codes are a stable contract for local API consumers and MCP clients.

**Override path**: human review + bump error code in `docs/error-codes.md` (which is also denylisted via `doc_covers_denied`).

## `Browserapp/lib/store.js`

**Why denylisted**: Store base class shipped in Phase 1 (commit `f5d40b9`). Subclasses (RpaStore, ProxyStore) inherit atomic-write, schema-version, backup semantics. Changing the contract breaks every subclass.

**Override path**: human review + run `pnpm test:coverage` after.

## `Browserapp/lib/log.js`

**Why denylisted**: Structured logger shipped in Phase 0 (commit `f8a9717`). All other modules depend on `log` singleton, `log.child(tag)`, redact behavior. Changing format breaks log scraping.

**Override path**: human review + verify no log line drops the JSON shape downstream consumers expect.

## `**/*.selftest.js`

**Why denylisted**: 70+ selftest scripts. Each has bespoke setup, custom assertions, and many use mock Electron APIs. Auto-merge on test files would risk silently breaking selftests that are not under `node:test` yet.

**Override path**: Migrate to `node:test` (already happening — `tests/unit/conversions/` is the path) + delete the selftest + human review.

## `package.json`, `pnpm-workspace.yaml`, `.npmrc`

**Why denylisted**: Monorepo layout, dependency graph, pnpm strict-peer-dependencies toggle. Wrong change = broken install for every contributor.

**Override path**: human review + `pnpm install --frozen-lockfile` clean.

## `eslint.config.js`, `.prettierrc.json`, `commitlint.config.js`

**Why denylisted**: Code style, commit lint, format. Auto-merge could silently flip rules and create churn across the codebase.

**Override path**: human review + run full lint/format check + commit message check.

## `husky/**`

**Why denylisted**: Pre-commit and commit-msg hooks. Removing/modifying = bypasses all quality gates.

**Override path**: human review + re-install hooks locally.
