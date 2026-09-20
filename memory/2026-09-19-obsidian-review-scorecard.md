# Obsidian community review scorecard (release 3.6.32)

## What failed
This is **not** GitHub Actions. CI (`Obsidian review lint`, `Build Obsidian Plugin`) is green after the 2026-09-18 pnpm workflow fix.

The failure is the **Obsidian community directory automated review** of GitHub release `3.6.32` ([issue #478](https://github.com/Nexus-JPF/note-companion/issues/478)). After **2026-10-30** a failing latest release is delisted.

Dashboard: https://community.obsidian.md/account/plugins/fileorganizer2000

Release `3.6.32` shipped `main.js` at **13,982,917 bytes (~13.3 MiB)**. After this pass, a local production build is **1.43 MB (1,498,585 bytes)**.

## Triage

### Must fix (user-facing or scanner-blocking)

| Finding | Cause | Fix |
| --- | --- | --- |
| `main.js` > 5 MB | Production esbuild had **no `minify`**. tiktoken WASM was inlined as a JS byte array. jimp pulled image codecs + Node `fs`. | `minify: prod`; replace tiktoken with a char/4 estimate; replace jimp with canvas; drop unused deps; fail the build if `main.js` exceeds 5 MB |
| Extra release file `checksums.txt` | Obsidian only downloads `main.js`, `manifest.json`, `styles.css` | Keep checksums in release notes; do not attach `checksums.txt` |
| Missing artifact attestations | Release workflow did not call `actions/attest-build-provenance` | Attest the three plugin assets before `gh release create` |
| Direct filesystem access | Bundled `jimp` + `platform: "node"` left `require("fs")` in `main.js` | Canvas compressor; `platform: "browser"` |
| Dynamic `eval` / `new Function` | tiktoken WASM glue (and possibly jimp) | Remove those deps from the plugin bundle |
| CSS `all` / `!important` / system fonts | Isolation reset and leaf padding overrides | More specific selectors + Obsidian CSS variables |

### Acceptable plugin behavior (document, do not "fix")

- **Vault enumeration** (`getMarkdownFiles` / `getFiles`): required for inbox, search tools, and organizer.
- **Clipboard write**: copy chat / logs. User-initiated only.
- **Vault read/write** via the Obsidian API: already a **Pass**.

### False positives (monorepo source scan)

The official scanner clones the **whole GitHub repo** and applies `eslint-plugin-obsidianmd` with **its** ignore list. It does **not** use this repo's `eslint.config.mjs` `files: packages/plugin/**` glob. ESLint 9 also ignores `.eslintignore`.

That is why the scorecard lists `packages/web`, `packages/mobile`, `packages/landing`, and `packages/release-notes` for `fetch`, `any`, `console`, `require()`, `setTimeout`, etc. Those packages are Next.js / Expo apps, not the Obsidian plugin.

Plugin TypeScript already passes `pnpm lint:obsidian-scan` (0 errors). Non-plugin packages are ignored in `eslint.config.mjs`.

Do **not** mass-rewrite web/mobile/landing to Obsidian rules (`requestUrl`, `window.setTimeout`, no `fetch`).

Tailwind `@tailwind` / `@theme` CSS hits in other packages are the same class of false positive. Our `pnpm lint:css` already ignores those trees.

## How to apply
```bash
pnpm install
pnpm lint:obsidian-scan
pnpm lint:css
pnpm --filter @file-organizer/plugin test
pnpm build   # fails if main.js > 5 MB
```

Preview the community scan before the next release: https://community.obsidian.md/account/plugins/fileorganizer2000

## Remaining risk after this pass
If the official scanner still lints `packages/web` / `packages/mobile` / `packages/landing`, those warnings will remain until Obsidian supports a source subdirectory or we split the plugin repo. Ask in the Community Directory Discord if that happens after the next release.
