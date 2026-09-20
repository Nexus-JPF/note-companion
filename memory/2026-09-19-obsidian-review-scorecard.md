# Obsidian community review scorecard

Dashboard: https://community.obsidian.md/account/plugins/fileorganizer2000  
Issue: [#478](https://github.com/Nexus-JPF/note-companion/issues/478)  
This is **not** GitHub Actions. The community directory clones the GitHub repo and scans the latest GitHub release. After **2026-10-30** a failing latest release is delisted.

## Outcome

| Release | Date | Directory status |
| --- | --- | --- |
| `3.6.32` | 2026-09-19 | Failed (`main.js` 13.98 MB, no attestations, extra `checksums.txt`) |
| `3.6.33` | 2026-09-20, commit `a9aade4` | **Completed** — plugin stays listed |

`3.6.33` also **Pass**: artifact attestations on `main.js` and `styles.css`, no vulnerable deps, `main.js` reproduced byte-for-byte from source. Local / CI production `main.js` is **1.43 MB** (build fails if it exceeds 5 MB).

## What we changed (for `3.6.33`)

| Finding on `3.6.32` | Fix |
| --- | --- |
| `main.js` > 5 MB | `minify: prod` in `packages/plugin/esbuild.config.mjs`; drop tiktoken WASM (char/4 estimate in `utils/token-counter.ts`); replace jimp with canvas (`lib/compress-image.ts`); remove unused plugin deps |
| Extra release file `checksums.txt` | Keep checksums in release notes only; do not attach the file (`.github/workflows/manual-release.yml`) |
| Missing artifact attestations | `actions/attest-build-provenance@v2` on `main.js`, `styles.css`, `manifest.json` |
| Direct `fs` / `eval` | Stopped bundling jimp and tiktoken; esbuild `platform: "browser"` |
| CSS `all` / `!important` / system fonts | More specific leaf selectors + Obsidian CSS variables in `packages/plugin/styles.css` |

Do **not** mass-rewrite `packages/web` / `packages/mobile` / `packages/landing` to Obsidian rules (`requestUrl`, `window.setTimeout`, no `fetch`). Those are Next.js / Expo apps. The official scanner does not use this repo's `eslint.config.mjs` plugin-only globs.

## Still on the `3.6.33` scorecard (informational)

**Keep — real plugin behavior**

- Vault enumeration (`getMarkdownFiles` / `getFiles`): inbox, search tools, organizer
- Clipboard write: copy chat / logs, user-initiated
- Vault read/write via the Obsidian API: already **Pass**

**Leftover plugin-adjacent warnings (did not block Completed)**

- **Direct Filesystem Access** on the Behavior scan of `main.js`. Plugin *source* only imports `fs` in `.mjs` build scripts (`esbuild.config.mjs`, `version-bump.mjs`, `normalize-css-hex.mjs`). Detector still fires on the bundle; not listing-blocking.
- **`document.createElement("canvas")`** in `packages/plugin/lib/compress-image.ts` — Obsidian prefers `createEl`. Introduced when replacing jimp.

**Ignore — monorepo false positives**

Every `fetch` / `any` / `console` / `require()` / `setTimeout` / unused-import hit on `packages/web`, `packages/mobile`, `packages/landing`, `packages/release-notes`. Same for CSS `@tailwind` / `@theme` in those packages and in plugin *source* `styles.css` (shipped artifact is compiled `styles.css` without those at-rules).

## How to apply
```bash
pnpm lint:obsidian-scan
pnpm lint:css
pnpm --filter @file-organizer/plugin test
pnpm build   # fails if main.js > 5 MB
```

Earlier Node-builtin / pnpm CI fixes: `memory/2026-09-18-plugin-obsidian-review-quick-win.md`.
