# CLAUDE.md

Project guidance for Claude Code. Keep this short and current.

## What this is

Movie Finder — a zero-build, vanilla JavaScript PWA for searching movies and TV
via the OMDb API. No framework, no bundler, no `node_modules` at runtime (npm is
only used transiently to generate icons / serve locally).

## Stack & layout

- `index.html` — app shell and markup.
- `main.js` — all app logic: debounced live search + autocomplete, `AbortController`
  for stale-request cancellation, in-memory + `sessionStorage` cache, the curated
  "browse rows" carousel, pagination, and filters.
- `style.css` — all styling (no CSS framework).
- `sw.js` + `manifest.webmanifest` + `icons/` — PWA / offline support.
- `movie.html` — standalone detail page.

## Conventions (follow these)

- **Vanilla only.** Do not introduce a framework, build step, or runtime
  dependency. Plain DOM APIs and `fetch`.
- **CSP-friendly.** No inline event handlers and no inline `<script>` — attach
  listeners in `main.js`. This is load-bearing for the deployed CSP.
- **OMDb realities.** No "trending" endpoint (home rows are curated title lists),
  10 results per page, 100-page hard limit. See the constants atop `main.js`.
- Match the existing code style: small helpers, descriptive names, comments only
  where intent isn't obvious.

## Running it

Serve over HTTP (the service worker needs a real origin, not `file://`):

```
npx --yes serve -l 8000 .
```

Then open http://localhost:8000. There are no automated tests; verify in-browser.

## Validate before committing

```
node --check main.js
```

Bump the cache version in `sw.js` whenever you change a cached asset, or the PWA
will serve stale files.
