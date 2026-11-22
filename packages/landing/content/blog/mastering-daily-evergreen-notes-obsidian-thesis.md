---
title: 'Obsidian Thesis Notes: Daily and Evergreen'
slug: 'mastering-daily-evergreen-notes-obsidian-thesis'
date: '2026-11-21'
category: 'Guides'
tags: ['obsidian', 'pkm', 'thesis', 'research', 'notes']
excerpt: 'Use daily notes to capture thesis work in Obsidian, then promote lasting ideas to evergreen notes. Here''s the workflow, and what Note Companion can do.'
image: '/blog/images/mastering-daily-evergreen-notes-obsidian-thesis.webp'
faq:
  - question: 'How do I decide what counts as an evergreen note?'
    answer: 'If an idea, theory, or insight feels reusable, or you reference it repeatedly, it is a good candidate for an evergreen note. Think of evergreen notes as knowledge you will want to cite or build on in your thesis or later work.'
  - question: 'What if I fall behind on processing daily notes?'
    answer: 'Don''t worry about perfection. Focus on regular, scheduled reviews, and use Note Companion''s inbox to file a backlog of notes. You still decide which ideas become evergreen notes.'
  - question: 'Should I use folders or tags for organizing evergreen notes?'
    answer: 'Both work. Folders (for example, evergreen/ or literature/) provide structure, while tags such as #theory or #methodology make retrieval easier. Combining them usually works best.'
---

## Daily Notes vs. Evergreen Notes: The Thesis Researcher's Dilemma

Juggling deadlines, literature, experiment logs, and advisor feedback can make thesis research feel overwhelming. In Obsidian, two note types stand out for managing this complexity: **daily notes** and **evergreen notes**.

- **Daily notes** catch fleeting thoughts, meetings, tasks, and raw insights as you work.
- **Evergreen notes** distill and connect enduring ideas, theories, and syntheses that evolve over time.

Mastering when and how to use each lets you capture the whirlwind of daily research while building a durable knowledge base you'll actually use when writing chapters.

**Short answer:** Use daily notes to capture meetings, tasks and raw ideas as they happen. During a regular review, turn recurring or reusable ideas into evergreen notes: one idea per note, written in your own words, and linked to related notes. Note Companion can tag, rename and file notes you drop into `_NoteCompanion/Inbox`, and the Organizer can suggest tags and a folder for the open note. It does not decide which ideas should become evergreen notes, and it does not suggest links on its own.

---

## Why Start with Daily Notes?

Daily notes are your research "inbox": a place to capture everything as it happens, without worrying about structure.

### What Goes in Daily Notes?
- Meeting summaries (`daily/2026-06-09.md` or `inbox/meeting-2026-06-09.md`)
- Ideas that pop up while reading
- Experiment results or troubleshooting logs
- Quick task lists

### Setting Up for Success
1. **Enable Obsidian's Daily Notes plugin:** Set your notes to auto-create into a `daily/` folder.
2. **Capture everything, judgment-free:** Don't filter yourself; note ideas, questions, and links as they emerge.
3. **Tag for later retrieval:** Use tags like `#meeting`, `#experiment`, `#reading` to add context without over-thinking.
4. **Drop references or links as you go:** Paste article URLs, DOIs, or internal links to related notes.

#### Example in Action
You meet your advisor on June 9 and record her feedback, tagging the note with `#meeting #experiment`. Later, you notice an observation about "cognitive load": you highlight it for later promotion to an evergreen note. This keeps your daily notes useful but lightweight.

---

## Building a Web of Evergreen Notes

Evergreen notes are where your best ideas mature. These are the building blocks for your literature review, methodology chapter, or even future projects.

### How to Create Effective Evergreen Notes
- **Give each note a unique, descriptive title:** e.g., `evergreen/cognitive-load.md`
- **Keep notes atomic:** Focus on a single concept, theory, or insight per note. See [atomic or whole notes](/blog/atomic-or-whole-notes-perfect-granularity-obsidian) for how to choose note size.
- **Add metadata:** Use tags like `#theory`, `#literature`, or YAML frontmatter for easy searching.
- **Wikilink related notes:** Connect concepts using Obsidian's `[[wikilink]]` syntax.

### Turning Raw Insights into Lasting Knowledge
1. **Spot patterns in your daily notes:** During review, look for repeated ideas or recurring references.
2. **Create an evergreen note:** Summarize the idea in your own words, add supporting references, and contextualize it within your research.
3. **Link both ways:** Reference the daily note where the insight emerged, and link to related evergreen notes.
4. **Update and expand:** Revisit evergreen notes as your understanding deepens or new literature emerges.

#### Example Workflow
You repeatedly encounter the concept of "cognitive load" in your readings and experiments. During your weekly review, you create `evergreen/cognitive-load.md`, synthesizing definitions and linking to related notes like `evergreen/working-memory.md`. Tags like `#theory` or `#literature` help you find this note later when writing.

---

## Connecting the Dots: A Repeatable Thesis Workflow

With both note types in place, your research process can flow smoothly from raw capture to organized knowledge.

### Step-by-Step Workflow
1. **Capture in Daily Notes:** Record meetings, spontaneous ideas, and experiment logs throughout your research day.
2. **Tag and highlight:** Add lightweight tags and highlight insights for follow-up.
3. **Weekly (or biweekly) review:** Set aside time to scan your daily notes for ideas worth preserving. A structured ritual helps; see [from inbox chaos to vault clarity](/blog/from-inbox-chaos-to-vault-clarity-weekly-review-obsidian-rituals).
4. **Promote to evergreen notes:** Summarize and synthesize key concepts in new evergreen notes.
5. **Link and organize:** Connect evergreen notes to each other and back to the relevant daily notes for full context.
6. **Use Map of Content (MOC) notes:** Create MOCs for major thesis sections (e.g., `MOC/Literature Review.md`) to visualize your knowledge graph. [Tagging vs Maps of Content](/blog/tagging-vs-maps-of-content-small-habit-shifts-research-obsidian) compares habits that keep MOCs useful.

This flow ensures daily notes remain actionable without becoming a dumping ground, and your evergreen notes become a rich, interconnected resource for writing.

---

## AI as a Research Assistant: Streamlining Note Processing

AI can take some of the filing work off your plate, as long as you are clear about what it actually does:

- **Inbox processing:** Drop notes into `_NoteCompanion/Inbox` and Note Companion tags, renames and files them.
- **Organizer suggestions:** For any open note, the Organizer suggests tags and a folder, and applies nothing until you click. Title suggestions exist but are off by default.
- **Transcripts:** To turn a meeting transcript into discussion points and action items, use Enhance note in the Meetings tab, then edit the result. Note Companion does not decide which ideas should become evergreen notes, and it does not suggest links on its own.

For example, after a week of experiments, drop raw notes into `_NoteCompanion/Inbox` so they are tagged and filed. During your review, you still choose which observations become evergreen notes.

---

## A Made-Up Example: Sarah's Organized Thesis Vault

Meet Sarah, a PhD candidate in cognitive psychology, struggling to keep her research organized as she juggles experiments, readings, and advisor feedback.

- **Daily capture:** She uses Obsidian's Daily Notes for all meeting notes, experiment logs, and reading reactions, tagging each entry (`#meeting`, `#reading`).
- **Inbox management:** Screenshots and audio transcriptions from lab sessions land in an `inbox/` folder.
- **Weekly review:** Each Friday, Sarah reviews her `daily/` and `inbox/` notes. She creates evergreen notes for recurring concepts like `evergreen/dual-task-interference.md`, tagging them with `#theory` and linking related notes.
- **AI assistance:** Note Companion suggests tags and a folder for a messy transcript (applied when she clicks), or files notes dropped into `_NoteCompanion/Inbox`.
- **Knowledge growth:** Her evergreen notes feed directly into her chapter outlines, making writing and literature synthesis less intimidating.

With this system, Sarah's chaos of daily research becomes a well-organized, interconnected vault.

---

## Checklist: Setting Up Your Thesis Notes Workflow

- [ ] Enable and configure Obsidian's Daily Notes plugin with a dedicated `daily/` folder
- [ ] Create an `evergreen/` folder to store atomic, concept-driven notes
- [ ] Define tags for daily notes (e.g., `#meeting`, `#experiment`, `#reading`)
- [ ] Schedule regular reviews to promote daily insights to evergreen notes
- [ ] Use Note Companion or similar AI tools for inbox processing and smart suggestion
- [ ] Consistently interlink evergreen notes for a robust knowledge graph

---

Balancing daily and evergreen notes in Obsidian transforms your research process: you'll capture every fleeting insight and build up a connected web of knowledge ready to drive your thesis forward. Start simple, review regularly, and use Note Companion to file incoming notes so you can spend review time on the ideas.
