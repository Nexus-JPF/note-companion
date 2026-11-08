# Episode 2 — the handwritten page

The physical prop for `packages/video/src/episodes/ep02-handwriting-to-notes.ts`.
Copy it out by hand, photograph it, and that photo is what goes into the inbox
on camera.

It picks up a thread the demo vault already has open: `Interview themes.md`
ends with a third "protecting a system" interview still outstanding, and two
sibling interview notes already sit in `Research/`. So the note has an obvious
place to land, and the folder suggestion should come back at high confidence
rather than the low-confidence guesses you get when the content does not belong
to the vault.

## The page

```
                    Interview — Ravi M.    24 Sep

 freelance editor, 5 clients
 vault ~2yrs, 900 notes

 • records every client call
 • transcribes maybe 1 in 3
   → rest sit in a folder he calls "the pile"

 • files everything by hand, ~20 min/day
   says it's the only reason the vault still works

 "I don't need it to be clever.
  I need it to be right every time."

 • tried auto-tagging 2024 → turned it off in a week
   everything came back #notes / #ideas   ← useless

 ★ ask next time: how big is the pile actually?

 same pattern as Dana. precision > recall.
```

## Why it is shaped like that

Abbreviations, arrows, a star, an aside. Clean block capitals prove nothing
about OCR; messy real notes do.

The quoted line is the payoff — quoted speech reads well in the output note, so
the before/after contrast is strongest there.

The last line names Dana, who is already in `Research/`, so the extracted note
may surface a real connection rather than sitting alone.

## Record this against a build that can read it

Two takes shot in October came back roughly 35% accurate, and the failures
looked like the page was at fault: `precision > recall` became "Persian vocal",
the quoted payoff became "I don't need the have drive". It was not the page.
`feat/unified-ocr-pipeline` transcribes this same page essentially verbatim.

What was wrong, per `memory/2026-09-28-ocr-pipeline-review.md` on that branch:

- The plugin's default `imageInstructions` asked the model to *describe* the
  image, and `/api/vision` asked it to transcribe. Both strings were
  concatenated, so the request was self-contradictory — which is why the output
  was fluent, confident and invented rather than visibly broken.
- `getModel(name)` ignored its argument, so the plugin path ran on `MODEL_NAME`
  (gpt-4.1-mini), not a vision model. The branch adds `getVisionModel()`,
  defaulting to gpt-4o via `VISION_MODEL`.
- Images were compressed to 1000px before upload; now 2048px.

**OCR runs server-side.** The plugin POSTs to `${serverUrl}/api/vision`
(`packages/plugin/index.ts`), so extraction quality follows whatever is
deployed, not which plugin build is installed locally. Recording against a
local server running the fix would produce footage that shipped users cannot
reproduce. Shoot this episode after the fix is merged and deployed, not before.

Do not quietly rewrite this page to make an older build look better. If the
extraction is wrong, the build is wrong.

## Photographing it

The October shoot got this right; keep doing it. Bright even light, dark pen,
page filling the frame, shot straight down, in focus. Crop out the spiral
binding if it is easy. Name the file something unhelpful, e.g. `IMG_4821.jpeg`,
so the rename at the end of the pipeline has something to push against.

## Test before you record

Dropping a photo in and reading the extraction takes about two minutes.
Recording a take takes fifteen. Do the cheap one first, every time: drop it in
the inbox, read the note, delete it, reset, repeat. Only start the recorder
once an extraction comes back clean.

Read the transcript, not just the finished note. The note goes through title,
format and tag steps afterwards, so a clean transcript can still produce a
scruffy note — and a bad note does not tell you which stage failed.

## The shot

Take 2 lost its own premise: the centre pane sat on an empty "New tab" for the
first 34 of 56 seconds, so the viewer never saw the handwritten page. The whole
episode is a before and after, and the before was missing.

Open the photo in the main pane first and leave it there. The order is:

1. Click the staged photo so it fills the centre pane. Hold on it.
2. Drag it into the inbox. The image stays open, so the page is still on screen
   while the panel works.
3. When processing completes, open the output note.

Know which note to open before you record. Take 2 opened two wrong notes before
finding the right one, and the hunting is in the footage.

## Where the photo lives between takes

Commit it into the vault at a staging path **outside** the inbox folder --
`demo-vault/Attachments/IMG_4821.jpeg` works. Two reasons:

1. The inbox processes whatever lands in it, immediately. If the photo is
   already there when you hit record, the interesting part has already
   happened. Worse, the plugin enqueues the *entire* inbox folder on load
   (`processBacklog()`, `packages/plugin/index.ts:1715`), so a photo sitting
   there gets eaten the moment you open the vault, before the recorder is even
   running.
2. `git checkout demo-vault/` only restores tracked files. The pipeline moves
   and renames the photo during processing, so if it is untracked you have to
   copy it back by hand before every take. Committed, the ordinary reset puts
   it back.

## Which folder is the inbox

Not `demo-vault/Unsorted/`. That folder holds three human notes for the
organizer demo and is deliberately *not* the inbox — see `docs/demo-vault.md`.

The inbox is whatever `pathToWatch` says in Settings -> Note Companion -> File
config, and the default is `_NoteCompanion/Inbox`. Leave it there. It is
gitignored, it starts every take empty, and it is the same path a viewer will
have after installing the plugin, so the footage matches their screen.

So on camera the drag is `Attachments/IMG_4821.jpeg` ->
`_NoteCompanion/Inbox/`, inside Obsidian, without a Finder window entering
frame. Expand `_NoteCompanion/` in the file tree *before* you start recording
so the drop target is already visible and the drag is one clean movement.

## Resetting between takes

`git checkout demo-vault/` restores the tracked notes and puts the photo back at
its staging path, but it will not touch `_NoteCompanion/` -- that whole tree is
gitignored, so the processed note, the moved attachment, the logs and the
backups all survive into the next take. Clear them explicitly:

```sh
git checkout demo-vault/
rm -rf demo-vault/_NoteCompanion
```

Then reopen the vault. The plugin recreates the folders it needs on load.
