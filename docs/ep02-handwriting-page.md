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

## Photographing it

- Dark pen, plain or lightly-lined white paper.
- Straight down, no shadow across the page, fill the frame.
- Slightly imperfect beats perfect. A faint angle and natural handwriting sell
  it; printed text is OCR on easy mode and viewers can tell.
- Name the file something unhelpful, e.g. `IMG_4821.jpeg`, so the rename at the
  end of the pipeline has something to push against.

## Where the photo lives between takes

Commit it into the vault at a staging path **outside** the inbox folder --
`demo-vault/Attachments/IMG_4821.jpeg` works. Two reasons:

1. The inbox processes whatever lands in it, immediately. If the photo is
   already there when you hit record, the interesting part has already
   happened.
2. `git checkout demo-vault/` only restores tracked files. The pipeline moves
   and renames the photo during processing, so if it is untracked you have to
   copy it back by hand before every take. Committed, the ordinary reset puts
   it back.

Then the drag from `Attachments/` into `Inbox/` happens on camera, inside
Obsidian, without a Finder window entering frame.
