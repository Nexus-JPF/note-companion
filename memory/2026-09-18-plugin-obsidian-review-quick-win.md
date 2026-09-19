# Plugin audit: Obsidian review quick wins (2026-09-18)

## Context
Issue [#478](https://github.com/Nexus-JPF/note-companion/issues/478): Obsidian community directory automated review is failing. After **2026-10-30** a failing latest release is delisted.

`memory/2026-06-10-obsidian-eslint-setup.md` still says ~2000 lint violations. That is stale. A local `pnpm lint:obsidian-scan` of `packages/plugin` (2026-09-18) had **6 errors**, all either:

1. Node builtins in inbox source (`crypto`, `events`) — real, scanner-visible
2. `packages/plugin/dist/main.js` leftover bundle — local only; official scanner ignore is the top-level `dist` name

## Shipped this pass
- Inbox file ids: drop Node `crypto` for a short FNV fingerprint (queue keys are not cryptographic)
- Inbox queue: drop unused Node `EventEmitter` (no listeners anywhere)
- esbuild: `builtinModules` from `node:module` instead of the `builtin-modules` package (scanner lists that package as replaceable)
- Restored vault-root `manifest.json` (iCloud had deleted it; plugin + eslint-plugin-obsidianmd both need it)

## Next review wins (not done)
- Remove unused plugin deps that never import: `natural`, `compromise`, `node-fetch`, `openai`, `lodash`, `form-data`. `moment` is a package.json dep but runtime uses Obsidian `window.moment`.
- Setup-mode selector on General (Cloud / Self-hosted / Ollama) — see `memory/2026-06-09-byok-setup-ux-followups.md`
- Monorepo scan risk: the community scanner ignores a fixed list, not this repo's eslint config. `packages/web` / `packages/mobile` can still pollute the Scorecard if the GitHub source URL is the whole monorepo.
- Preview scan from https://community.obsidian.md/account/plugins/fileorganizer2000 before the next release

## How to apply
```bash
pnpm lint:obsidian-scan
pnpm --filter @file-organizer/plugin test
```
After this pass, `pnpm lint:obsidian-scan` on `packages/plugin` is 0 errors / 0 warnings. Preview the community directory scan before the next release.

## CI (2026-09-18)

[Obsidian review lint #83](https://github.com/Nexus-JPF/note-companion/actions/runs/35411518611/job/105811927638) failed in 10s on `actions/setup-node@v4`:

`Dependencies lock file is not found … Supported file patterns: package-lock.json, npm-shrinkwrap.json, yarn.lock`

Cause: `.github/workflows/obsidian-review-lint.yml` used `cache: npm` + `npm ci` (“scanner compatibility”), but this repo is pnpm-only (`pnpm-lock.yaml`, `packageManager: pnpm@10.8.1`). The community scanner does not run this workflow; it clones source and runs its own ESLint.

Fix: install with `pnpm/action-setup@v4` + `cache: pnpm` + `pnpm install --frozen-lockfile`, then `pnpm lint:obsidian-scan`, `pnpm lint:css`, `pnpm build`. Node 20 deprecation on checkout/setup-node v4 is a runner warning, not this failure.

[Manual Plugin Release #132](https://github.com/Nexus-JPF/note-companion/actions/runs/35412068044/job/105813512036) hit the same `cache: npm` error in 9s. `.github/workflows/manual-release.yml` installed pnpm after setup-node, then ran `npm ci` / `npm run build`. Fix: pnpm first, `cache: pnpm`, one `pnpm install --frozen-lockfile`, `pnpm --filter @file-organizer/release-notes build`, `pnpm build`. No other workflows still use `npm ci`.
