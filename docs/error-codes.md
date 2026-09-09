# Error codes

OpenBrowser surfaces errors through several transport layers:

| Layer | Where the error appears | Format |
|-------|------------------------|--------|
| Electron IPC | `event.sender.send('error', err.toJSON())` or thrown | `AppError` instance, `toJSON()` shape |
| Local HTTP API | HTTP response body `{ code, msg, data }` | `{ code: 'PROFILE_LOCKED', msg, data: null }` |
| MCP stdio | JSON-RPC error response | `{ code: -32000, message, data: { code: 'MCP_TOOL_DENIED', ... } }` |
| Renderer UI | toast / dialog | localized via `userMessage` i18n key |

Every thrown error is an instance of `AppError` (`Browserapp/lib/errors.js`).
The string `code` is the **stable machine-readable identifier**; clients
should branch on it. The `message` is developer-facing English; the
`userMessage` is an i18n key for end-user display.

## Categories

| Prefix | Domain | Stability |
|--------|--------|-----------|
| `PROFILE_*` | Profile lifecycle (start, stop, lock) | stable |
| `KERNEL_*` | Browser binary selection / startup | stable |
| `PROXY_*` | Proxy configuration / reachability | stable |
| `FINGERPRINT_*` | Fingerprint generation / injection | stable |
| `RPA_*` | RPA plan / task / step execution | stable |
| `LOCAL_API_*` | HTTP API server errors | stable |
| `MCP_*` | MCP protocol errors | stable |
| `CLOUD_*` | Cloud backup / restore | stable |
| `STORE_*` | Persistent store errors | stable |
| `VALIDATION_*` / `CONFIG_*` | Input validation | stable |
| `UNKNOWN_ERROR` | Catch-all fallback | stable |

## Reference

| Code | Class | Default retryable | User message key | Description |
|------|-------|-------------------|------------------|-------------|
| `PROFILE_LOCKED` | `ProfileLockedError` | no | `error.profile.locked` | Another instance holds the profile lock; user must close the other one. |
| `PROFILE_LOCK_UNRECOVERABLE` | `ProfileLockUnrecoverableError` | no | `error.profile.lockUnrecoverable` | Profile lock file is malformed or cannot be verified; refuse to remove. |
| `PROFILE_NOT_FOUND` | `ProfileNotFoundError` | no | `error.profile.notFound` | Requested profile id does not exist. |
| `PROFILE_ALREADY_EXISTS` | `ProfileAlreadyExistsError` | no | `error.profile.alreadyExists` | Tried to create a profile with an id that is already taken. |
| `PROFILE_START_FAILED` | `ProfileStartFailedError` | yes | `error.profile.startFailed` | Chromium failed to start (binary missing, profile corrupt, etc.). |
| `PROFILE_STOP_FAILED` | `ProfileStopFailedError` | no | `error.profile.stopFailed` | Profile did not shut down cleanly within the timeout. |
| `INVALID_PROFILE_ID` | `InvalidProfileIdError` | no | `error.profile.invalidId` | Profile id has invalid characters or is the wrong length. |
| `KERNEL_NOT_READY` | `KernelNotReadyError` | yes | `error.kernel.notReady` | Bundled kernel binary is missing or policy mismatch. |
| `KERNEL_DOWNLOAD_FAILED` | `KernelDownloadFailedError` | yes | `error.kernel.downloadFailed` | Wayfern feed unreachable or download integrity check failed. |
| `KERNEL_STARTUP_TIMEOUT` | `KernelStartupTimeoutError` | yes | `error.kernel.startupTimeout` | Chromium did not expose DevTools port within the timeout. |
| `PROXY_UNREACHABLE` | `ProxyUnreachableError` | yes | `error.proxy.unreachable` | TCP connect to proxy host:port failed or timed out. |
| `PROXY_AUTH_FAILED` | `ProxyAuthFailedError` | no | `error.proxy.authFailed` | Proxy returned 407 / credential rejected. |
| `INVALID_PROXY` | `InvalidProxyError` | no | `error.proxy.invalid` | Proxy URL is malformed or scheme not supported. |
| `FINGERPRINT_CONFLICT` | `FingerprintConflictError` | no | `error.fingerprint.conflict` | Persona attributes are mutually inconsistent (e.g. UA OS vs font table). |
| `FINGERPRINT_INJECTION_FAILED` | `FingerprintInjectionFailedError` | yes | `error.fingerprint.injectFailed` | CDP injection target closed before the script ran. |
| `RPA_PLAN_NOT_FOUND` | `RpaPlanNotFoundError` | no | `error.rpa.planNotFound` | Requested plan id does not exist. |
| `RPA_TASK_NOT_FOUND` | `RpaTaskNotFoundError` | no | `error.rpa.taskNotFound` | Requested task id does not exist. |
| `RPA_STEP_FAILED` | `RpaStepFailedError` | no (configurable) | `error.rpa.stepFailed` | A specific step reported failure (selector missing, etc.). |
| `RPA_TIMEOUT` | `RpaTimeoutError` | yes | `error.rpa.timeout` | An RPA operation exceeded its time budget. |
| `LOCAL_API_UNAUTHORIZED` | `LocalApiAuthError` | no | `error.api.unauthorized` | Missing or wrong api-key header / bearer. |
| `LOCAL_API_ORIGIN_DENIED` | `LocalApiOriginError` | no | `error.api.originDenied` | Origin header not in CORS allowlist. |
| `MCP_TOOL_DENIED` | `McpToolDeniedError` | no | `error.mcp.toolDenied` | Tool not allowed under current permission mode. |
| `CLOUD_UPLOAD_FAILED` | `CloudUploadFailedError` | yes | `error.cloud.uploadFailed` | WebDAV/GitHub/cloud provider rejected upload. |
| `CLOUD_DOWNLOAD_FAILED` | `CloudDownloadFailedError` | yes | `error.cloud.downloadFailed` | Backup payload could not be fetched. |
| `STORE_CORRUPT` | `StoreCorruptError` | no | `error.store.corrupt` | Persistent JSON file is unparseable and no .bak exists. |
| `STORE_MIGRATION_FAILED` | `StoreMigrationError` | no | `error.store.migrationFailed` | Stored version is newer than this build supports. |
| `VALIDATION_FAILED` | `ValidationError` | no | `error.validation.failed` | Input did not pass schema validation. |
| `CONFIG_INVALID` | `ConfigError` | no | `error.config.invalid` | Cloud / local / MCP config is missing or malformed. |
| `UNKNOWN_ERROR` | (catch-all) | no | `error.unknown` | Wrapped by `toAppError()` from any non-AppError value. |

## Client handling recipe

```js
// Local API client
const res = await fetch('http://127.0.0.1:50325/api/v1/browser/start', {
  headers: { 'api-key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ profile_id: 'p1' }),
});
const body = await res.json();
if (body.code !== 0) {
  switch (body.code) {
    case 'PROFILE_LOCKED':     return retryAfter(userClosesOther);
    case 'PROFILE_NOT_FOUND': return createProfileThenRetry();
    case 'KERNEL_NOT_READY':  return downloadKernelAndRetry();
    default: throw new Error(body.msg);
  }
}
```

```js
// MCP tool caller
try {
  await mcp.call('rpa_run_steps', { profile_id, steps });
} catch (error) {
  if (error.data?.code === 'MCP_TOOL_DENIED') {
    showToast(t('error.mcp.toolDenied'));
  } else if (error.data?.retryable) {
    scheduleRetry();
  }
}
```

## Migration policy

- Adding a new error class: keep `code` stable, add tests in `tests/unit/errors.test.js`.
- Renaming a `code`: requires a major version bump; provide backward-compat
  alias for at least one release cycle.
- Removing a class: requires marking it `@deprecated` first; renderer should
  fall back to the `userMessage` i18n key it provided.

## See also

- `Browserapp/lib/errors.js` — implementation
- `tests/unit/errors.test.js` — coverage for every class
- `docs/security/csp.md` — CSP-related policy
