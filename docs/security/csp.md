# Content Security Policy (CSP)

OpenBrowser's main UI runs in an Electron renderer process. The HTML
shell (`Browserapp/index.html`) carries a strict CSP via `<meta>` tag.

## Current policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' http://127.0.0.1:50325 ws://127.0.0.1:50325;
frame-src 'none';
frame-ancestors 'none';
object-src 'none';
base-uri 'self';
form-action 'none';
```

## Rationale

| Directive | Value | Why |
|-----------|-------|-----|
| `default-src 'self'` | strict | Block any resource loaded from another origin (CDN, ads, trackers). |
| `script-src 'self'` | strict, no `unsafe-eval` | No inline `<script>` and no `eval()`. The only scripts are `i18n.js` and bundled extension `.js`, all local. |
| `style-src 'self' 'unsafe-inline'` | inline allowed | Theme code reads CSS variables and sets `documentElement.style.setProperty(...)`. Refactoring to all-static CSS would let us drop `'unsafe-inline'`. |
| `img-src 'self' data: blob:` | local + inline | Brand logos (local PNGs) and DOM-screenshot data URIs from RPA. No remote image fetches. |
| `font-src 'self' data:` | local | Bundled pixel font under `assets/fonts/`. No webfont fetches. |
| `connect-src 'self' http(s)://127.0.0.1:50325 ws://127.0.0.1:50325` | loopback + WS | Local API binds to `127.0.0.1:50325` only; renderer may `fetch()` or open a WebSocket to it. |
| `frame-src 'none'` | no iframes | Renderer never embeds cross-origin content. |
| `frame-ancestors 'none'` | not embeddable | Other sites cannot iframe OpenBrowser. |
| `object-src 'none'` | no plugins | Disallow `<object>`, `<embed>`, `<applet>` legacy vectors. |
| `base-uri 'self'` | no `<base>` injection | An injected `<base>` tag cannot rewrite relative URLs to attacker-controlled origins. |
| `form-action 'none'` | no form posts | The UI has no `<form method="POST">`; anything attempting to submit would be blocked. |

## What this blocks

- **XSS via injected `<script>`** — inline and remote scripts both rejected
- **CSS exfiltration** — no remote stylesheets
- **Form-based CSRF** — no form submission allowed
- **Clickjacking / framing** — `frame-ancestors 'none'`
- **Base-tag injection** — `base-uri 'self'`
- **Plugin abuse** — `object-src 'none'`

## What it allows (intentional)

- Inline styles for theme CSS variable updates via `element.style.setProperty(...)`.
  This is the only `unsafe-*` relaxation. It can be removed by refactoring
  the theme code to use static CSS variables in `:root` and class swapping.
  (Phase 3 candidate.)
- `data:` and `blob:` images for canvas-screenshot previews from RPA
  execution and local user uploads.

## Migration path for stricter policy

To remove `'unsafe-inline'` from `style-src`:

1. Inventory all `element.style.setProperty(...)` and inline `style="..."` in
   `index.html` / `renderer.js`.
2. Convert each to a CSS class that the theme layer toggles.
3. Update the CSP meta tag in `index.html`.
4. Verify all themes still render correctly across the 5 theme variants.

## See also

- `Browserapp/index.html` — the `<meta http-equiv="Content-Security-Policy">`
- `Browserapp/main.js` — `will-navigate`, `setWindowOpenHandler`,
  `will-attach-webview` handlers that complement CSP at the Electron layer
- `docs/security/` — additional hardening notes
