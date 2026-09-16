# @note-companion/video

The branded wrapper around hand-captured product footage. Title cards, lower
thirds, captions and end cards are rendered by this package; the product footage
itself is a screen recording you make once.

**One capture, two outputs.** `Episode` is the 16:9 YouTube cut. `Clip` is the
same episode reframed 9:16 for LinkedIn. They share one source file, so a change
to the script changes both. There is no second edit to keep in sync.

## Render

```bash
pnpm --filter @note-companion/video dev              # Remotion studio, live preview
pnpm --filter @note-companion/video render:episode   # out/episode.mp4  (1920x1080)
pnpm --filter @note-companion/video render:clip      # out/clip.mp4     (1080x1920)
```

`build` is a typecheck, not a render — `turbo build` should not spend minutes
driving a browser.

On a machine without a bundled Chromium, pass one:

```bash
npx remotion render Episode out/episode.mp4 --browser-executable=/path/to/chrome
```

## Making an episode

1. Write the captions first. They are the narration script, and writing them
   first is what makes the capture easy — you already know what has to be on
   screen and when.
2. Render with `footage: undefined`. The composition draws a capture-spec
   placeholder, so you can review pacing before shooting anything.
3. Shoot `demo-vault/` to the script (see `docs/demo-vault.md`).
4. Drop the file in `public/`, set `footage`, re-render.

A new episode is a file in `src/episodes/` and two lines in `src/Root.tsx`. See
`src/episodes/ep01-youtube-to-notes.ts`.

## The ten decisions

Everything the kit standardises lives in `src/tokens.ts`. That file *is* the
video design system — it is deliberately small.

| | | |
|---|---|---|
| Accent | `#7c3aed` | Matches the accent pinned in `demo-vault/.obsidian/appearance.json`, so footage and wrapper agree |
| Type | 3 sizes | Not a scale. Screen-reading scales are useless at phone size |
| Easing | `cubic-bezier(0.22, 1, 0.36, 1)` | Lifted from the landing page's `hero-fade-up`, which is why the videos feel like the site |
| Frame rate | 30fps | |
| Formats | 1920×1080, 1080×1920 | 1920×1080 is exactly 1.25× the 1536×864 capture, so footage lands pixel-aligned |
| Safe areas | per format | Vertical reserves more at the bottom; LinkedIn, Reels and Shorts all overlay it |
| Captions | burned in | Most feed views are muted |

## Two things worth knowing

**Captions sit above the lower-third band, always.** Even when no lower third is
on screen. A caption that changes position between lines is harder to read than
one sitting slightly higher than it strictly needs to.

**The vertical crop is right-biased, not centred** (`focusX` defaults to `0.78`).
The Note Companion panel occupies the right ~32% of the Obsidian window. Centring
a 16:9 capture in a 9:16 frame shows the file tree and crops out the product.

## Tokens are copied, not imported

`src/tokens.ts` duplicates values from `packages/landing/app/globals.css` rather
than importing them. A video render should not break because a CSS variable
moved. If the two drift, that is a signal worth acting on, not a bug to paper
over with a shared package.
