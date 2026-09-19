# Demo vault

`demo-vault/` is a fixed Obsidian vault used for every screen recording and
screenshot. Its whole purpose is that episode 12 looks like episode 1.

The four GIFs in `docs/screenshots/` were shot in a single sitting on a real
personal vault. They are internally consistent — identical 5fps, identical light
theme, identical pane layout — but they are not *reproducible*, and the vault on
screen contains duplicate notes, files named `test 2`, and unrelated personal
content. This vault fixes both problems.

## Why a vault and not a design system

The plugin inherits Obsidian's theme. Every colour token in
`packages/plugin/tailwind.config.js` maps to an Obsidian CSS variable
(`--interactive-accent`, `--background-primary`, `--text-normal`), which is
correct for an Obsidian plugin and means **no branding decision on our side
controls a single pixel of the footage**. Only the recording environment does.

`demo-vault/.obsidian/appearance.json` therefore pins the accent to `#7c3aed`
explicitly. In the existing GIFs the accent measures hue 256 — almost exactly
our brand purple — purely because the recording machine happened to be on
Obsidian's default theme. This makes that deliberate rather than lucky.

## One-time setup

1. Open `demo-vault/` in Obsidian as a vault.
2. Install Note Companion into it and add a license key. The plugin build and
   its `data.json` are gitignored, so the key never gets committed.
3. Set the pane layout you want on camera: file explorer left, note centre,
   Note Companion sidebar right.
4. Commit `.obsidian/workspace.json`. From then on the layout — including sidebar
   widths — is restored along with everything else.

`workspace.json` is not committed yet because it has to come from a real
Obsidian session; hand-writing one gets silently overwritten on launch.

## Before every recording

```bash
git checkout demo-vault/          # discard anything the last take changed
./scripts/demo-recording/set-window.sh   # pin the window to 1536x864
```

The reset is the point. The plugin moves, renames, and rewrites notes during a
demo, which is exactly what it should do — and it means the vault is dirty after
every take. `git checkout` puts it back.

`1536x864` is exactly 16:9, so a Retina capture downscales cleanly to 1080p.

## What `set-window.sh` does

It resizes the Obsidian window to exactly 1536x864 and moves it to (80, 80),
by driving System Events through AppleScript. That is all it does — it does not
record anything, and it does not touch the vault.

It exists because window size is the one recording variable you cannot fix
afterwards. The four original README GIFs came out 1512x862, 1512x862, 1512x862
and 1510x862: close, but neither 16:9 nor consistent with each other, because
the window was sized by hand. Running one command instead removes the variable.

macOS-only, and it needs Accessibility permission for whichever terminal runs
it (System Settings → Privacy & Security → Accessibility). It refuses with a
clear message if Obsidian is not already running, or if you are not on macOS.
Pass different dimensions as arguments if you ever need them:
`./scripts/demo-recording/set-window.sh 1920 1080`.

## Recording with CleanShot X

Any recorder works — the kit only needs an MP4. CleanShot is a good fit, with
four settings that matter:

**Capture a fixed area, not the window.** This is the one that will bite you.
macOS window capture usually includes the drop shadow, which silently breaks
the exact 1536x864 and puts you back where the old GIFs were. Run
`set-window.sh` first, then select a capture *area* of exactly 1536x864.
CleanShot shows live dimensions as you drag and can restore the previous
selection, which is what makes it repeatable between episodes.

**Record at full Retina, not scaled.** On a Retina display that area captures
at 3072x1728, and downscaling that into 1080p is noticeably sharper than
upscaling a 1x capture. Check the recorder is not set to 1x.

**Turn on cursor highlighting and click visualisation.** This is where CleanShot
earns its place over `Cmd+Shift+5`. In a plugin demo the viewer has to see
*where* a click landed — which sidebar tab, which suggestion chip — or they lose
the thread. Hide desktop icons while you are in there.

**Record at 30fps**, matching `FPS` in `packages/video/src/tokens.ts`. 60 works
but doubles the file for no visible gain on a screen recording.

Export MP4, drop it in `packages/video/public/`, set `footage` in the episode
file, and render.

What no recorder can fix: an Obsidian notice drawn over the window is inside the
capture regardless. See **Known gotchas** below.

## What's already pinned

| Setting | Value | Why |
|---|---|---|
| `accentColor` | `#7c3aed` | On-brand footage regardless of local theme |
| `theme` | `moonstone` (light) | Matches existing GIFs and README |
| `baseFontSize` | `18` | 16 is unreadable once downscaled to 1080p |
| `spellcheck` | `false` | No red squiggles on camera |
| `showLineNumber` | `false` | Less chrome in frame |
| `graph`, `canvas`, `tag-pane` | off | Fewer ribbon icons to explain |

## The content

Eleven notes, one coherent scenario: a product researcher running customer
interviews for an onboarding redesign.

```
Inbox/              three unfiled notes, for the organizer demo
Meetings/           one meeting note with action items
Projects/           the project the research feeds
Research/           two interviews plus a synthesis note
Reference/          two evergreen notes
```

`Inbox/Untitled.md` is deliberately untitled — it is the note the title
suggestion acts on, and its content is unambiguous enough that a good suggestion
is obviously good.

Keep it small. A vault this size loads instantly, fits in the file tree without
scrolling, and every note on screen is one a viewer might plausibly have written.
Adding notes for their own sake is how you end up back where the old GIFs were.

## Known gotchas

**Obsidian notices cover the sidebar tabs.** In `organizer-demo.gif` and
`youtube-demo.gif` the `"Formatting content..."` notice
(`packages/plugin/index.ts:544`) sits directly on top of the Meetings tab. The
panel already shows an `Applying…` spinner, so the notice is duplicate feedback.
Until that's resolved in the product, plan shots so a notice isn't firing while
the tab bar is the subject.

**The AI is non-deterministic.** You cannot reshoot a take and get the same
suggestion, title, or chat response. If a cut depends on specific output, either
shoot it in one pass or extend `packages/plugin/__mocks__/` into a demo mode
with canned responses. The second option is also how you show the product at its
best rather than at whatever it did that afternoon.

**Never record with a real vault.** Beyond the polish argument: `meeting-demo.gif`
was removed from the README because it showed an audio filename that looked like
real meeting participants. The name was baked into every frame, so there was no
fixing it short of deleting the asset. Re-record the meeting demo here.

## Accent colour

`#7c3aed` (Tailwind `violet-600`) is the accent across the product. It is 7°
from the `#7852ee` declared in `packages/landing/app/globals.css` — visually
identical — and it is already the most-used accent in the web dashboard, so it
is the value the rest of the codebase should converge on rather than a new one
to roll out.
