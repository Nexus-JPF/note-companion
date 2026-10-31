---
title: 'Obsidian Properties: A YAML Frontmatter Guide'
headline: 'Build a Consistent Metadata Foundation with Obsidian Properties'
slug: 'consistent-metadata-foundation-yaml-front-matter-obsidian'
date: '2026-10-31'
category: 'Guides'
tags: ['obsidian', 'properties', 'yaml-front-matter', 'metadata', 'migration']
excerpt: 'Plan one property schema, enforce it with a template, and query it with Dataview or Bases: a YAML frontmatter guide for Obsidian users coming from Notion.'
image: '/blog/images/consistent-metadata-foundation-yaml-front-matter-obsidian.webp'
faq:
  - question: What is the difference between properties and YAML frontmatter in Obsidian?
    answer: >-
      They are the same data. Properties is Obsidian's name for the YAML frontmatter block at the top of a note, shown in an editable panel. Editing either one changes the same fields.
  - question: Should I put tags in YAML frontmatter or inline?
    answer: >-
      Pick one as your default. YAML tags keep metadata in one place and are easy to edit in the properties panel; inline tags are quicker while writing. Dataview's file.tags and Obsidian search read both.
  - question: How do I add YAML frontmatter to old notes in bulk?
    answer: >-
      The Linter plugin can insert required keys and move inline tags into YAML across many files, and the All properties view renames a field vault-wide. Note Companion's inbox folder can tag, rename and file imported notes automatically; turn on "Use similar tags in frontmatter" so tags go into YAML.
  - question: Can I search Obsidian notes by property?
    answer: >-
      Yes. Core search supports property queries such as [status:draft], and you can bookmark the search. Dataview and the core Bases plugin build tables filtered by properties.
  - question: Does Notion metadata survive the move to Obsidian?
    answer: >-
      Mostly, if you use Obsidian's Importer plugin instead of Notion's Markdown export. Importer converts pages to Markdown with properties; expect to rename some fields to match your schema afterwards.
---

## What Are Obsidian Properties?

**Short answer:** Properties are the YAML frontmatter block between `---` lines at the top of an Obsidian note. They store structured fields such as `tags`, `status`, `created` and `authors`. Pick a small set of field names once, put them in a template, and every note becomes filterable in search, Dataview or Bases.

| Field | Type | Example | Used for |
| --- | --- | --- | --- |
| `tags` | List | `[research, literature-review]` | Topics |
| `status` | Text | `draft` | Workflow stage |
| `created` | Date | `2026-10-31` | Sorting and reviews |
| `type` | Text | `meeting-note` | Note kind |
| `authors` | List | `[J. Smith]` | People |

Migrating from Notion or Roam to Obsidian gives you flexibility, but you're now responsible for how your notes are structured and found. Without a consistent schema, field names drift (`project` here, `category` there) and queries quietly miss notes. Getting this right at the start saves hours of cleanup later.

## What Is YAML Front Matter and Why Use It?

YAML front matter is a structured block, wrapped in triple dashes (`---`), placed at the very top of your notes. Obsidian calls these fields [properties](https://obsidian.md/help/properties) and shows them in an editable panel above the note. Obsidian reads those keys as **Properties**: the same fields you would edit in the sidebar or in the All properties view. They behave much like Notion database properties or Roam attributes, but they live in plain text under your control.

Example:

```yaml
---
tags:
  - research
  - literature-review
status: draft
created: 2026-10-31
authors:
  - J. Smith
---
```

Why use YAML over just inline tags? YAML is more easily parsed by plugins (like Dataview), supports complex metadata (like lists or dates), and keeps your vault interoperable for future automation or export. Obsidian's [Properties documentation](https://help.obsidian.md/Editing+and+formatting/Properties) explains how front matter maps to the Properties UI.

## Step 1: Design Your Metadata Schema Before Migration

Before importing anything, review the metadata fields you relied on in Notion or Roam:

- **Tags** for topics, status, or priority
- **Dates** (created, modified, due, reviewed)
- **Categories** or project names
- **People** (authors, collaborators)
- **Custom fields** (e.g., `status: draft`, `type: meeting-note`)

Spend a few minutes deciding which fields you'll keep and what you'll name them. Consistency now prevents chaos later—if you call it `project` in some notes and `category` in others, you'll regret it when running queries. Not sure whether a field should be a tag, a property or a link? See [tagging vs Maps of Content](/blog/tagging-vs-maps-of-content-small-habit-shifts-research-obsidian).

Tip: Write out your chosen fields and example values in a reference note (e.g., `meta/metadata-schema.md`). This can double as team documentation if you collaborate.

## Step 2: Create Obsidian Templates for Consistent Metadata

Templates are your secret weapon for enforcing clean metadata. Use the core [Templates plugin](https://obsidian.md/help/plugins/templates) to set up a note template with your properties, and keep it short ([why minimal templates work better](/blog/rethinking-templates-flexible-monday-workflow-obsidian)).

Sample template (`Templates/Note Template.md`):

```yaml
---
tags: []
status: draft
created: {{date:YYYY-MM-DD}}
authors: []
---

# {{title}}

```

With this in place, you (and collaborators) can hit one hotkey and always begin with the right schema. The `created` field auto-fills today's date for a reliable audit trail.

## Step 3: Migrate and Annotate Legacy Notes

Moving from Notion or Roam? Use Obsidian's official [Importer plugin](https://obsidian.md/help/plugins/importer) rather than a plain Markdown export. Notion's Markdown export drops data, while Importer converts pages to Markdown and maps fields to properties you can preview before importing. Whatever arrives, it rarely matches your new schema exactly, so plan a cleanup pass:

1. **Import everything into `inbox/`** — keeps your vault tidy while you process.
2. **Open each note and scan for key info** — topics, dates, authors, statuses.
3. **Add YAML front matter at the top** using your template and fill in relevant fields.
4. **Move the note to its destination folder** (e.g., `projects/`, `research/`, `meeting-notes/`). Still choosing a structure? Compare [Zettelkasten vs PARA in Obsidian](/blog/zettelkasten-vs-para-obsidian-workflow).

This step is manual for many vaults, but it's your chance to upgrade and unify your metadata. Resist the urge to skip—future you will thank you. For a larger pile, see [strategies to process a backlog of unorganized notes](/blog/taming-backlog-strategies-process-unorganized-notes).

### Speed Up with Note Companion

If you're staring down hundreds of notes, [Note Companion](https://www.notecompanion.ai) can take the first pass:

- **Organizer suggestions:** open a note and the Organizer suggests tags (your existing vault tags are listed separately from new ones) and a destination folder. Nothing is applied until you click a suggestion, so your schema stays in charge.
- **Hands-off inbox:** move imported notes into Note Companion's inbox folder (`_NoteCompanion/Inbox` by default) and it tags, renames and files them automatically. Start with a small batch and check the results before moving the rest.
- **Keep tags in YAML:** by default Note Companion appends tags inline at the end of the note. Turn on **Settings → Organization Preferences → Use similar tags in frontmatter** so they land in your `tags:` property instead.
- **Fill other fields from chat:** @-mention a note in Note Companion's chat and ask it to set a property, such as `status: draft`.

Fields like `authors` and `status` still need your judgement, so review before you move on.

For when AI tagging helps and when it adds clutter after a migration, read [AI tagging in Obsidian](/blog/balancing-ai-tagging-obsidian-clarifies-versus-clutters).

## Step 4: Keep Metadata Clean—Automate Checks and Reviews

Your vault will only stay tidy if you maintain discipline. Here's how:

- **Schedule a weekly (or monthly) metadata review.** Use a recurring task in Daily Notes, a calendar reminder, or an [Obsidian weekly review ritual](/blog/from-inbox-chaos-to-vault-clarity-weekly-review-obsidian-rituals).
- **Rename a field everywhere** from the core [All properties view](https://obsidian.md/help/plugins/properties): right-click a property and rename it across the vault.
- **Use the [Linter](https://github.com/platers/obsidian-linter) plugin** to standardize YAML formatting, insert required keys, and move inline `#tags` into YAML (its "Insert YAML attributes" and "Move tags to YAML" rules). [MetaEdit](https://github.com/chhoumann/MetaEdit) is handy for quick per-note edits.
- **Check for empty or inconsistent fields** using Dataview queries (e.g., notes missing a `status` or `created` field). The **All properties** and Tags views help to spot near-duplicates by eye.

## Step 5: Unlock Powerful Workflows with Metadata-Driven Queries

Now you can reap the rewards. With structured YAML front matter and Properties, you enable:

- **Dataview dashboards:** Summarize all `status: draft` notes or find everything tagged `#research` from last month.
- **Bookmarked searches:** Search by property (for example `[status:draft]`) and bookmark the search to reuse it.
- **Custom review cycles:** Build your own spaced repetition or project management workflows using metadata as triggers.

Example Dataview query: List all draft research notes, newest first.

```dataview
TABLE status, created
WHERE status = "draft" AND contains(file.tags, "#research")
SORT created DESC
```

Prefer no plugins? Obsidian's core [Bases](https://obsidian.md/help/bases) plugin builds similar filtered tables from properties.

## Real-World Scenario: A Researcher's Metadata Migration

Meet Emma (a composite example), a graduate student with 200+ literature notes in Notion, each tagged by topic, author, and status. After importing them into Obsidian, she had notes in `inbox/` whose fields used Notion's old names and formats. Emma:

- Defined her YAML schema: `tags`, `authors`, `status`, `created`.
- Built a template and pasted it atop each imported note.
- Turned on "Use similar tags in frontmatter", then opened each note and accepted or skipped the Organizer's tag and folder suggestions.
- Moved processed notes to `research/lit-review/`.
- Queried for `status: draft` notes to prioritize revision using Dataview.

Emma's weekend effort paid off: her vault is now organized, searchable, and ready for advanced workflows.

## Checklist: Start Your YAML Metadata Hygiene

- [ ] List and standardize your metadata fields
- [ ] Create a template with YAML front matter
- [ ] Import legacy notes into `inbox/`
- [ ] Annotate each note with structured metadata
- [ ] Use Note Companion's Organizer or inbox folder for a first pass on tags and folders, then review
- [ ] Move notes to correct folders
- [ ] Set a recurring review cadence
- [ ] Build queries and dashboards based on your metadata

## Tips for Lasting Metadata Health

- Stick to a minimal, meaningful set of metadata fields to avoid clutter.
- Use either YAML Properties or inline tags as a primary method for tags; don't mix unless you have a clear reason.
- Choose consistent, descriptive tag names (e.g., always `#meeting-notes`, never `#meetingnote` or `#mtg`).
- Archive or update notes as projects move forward to reflect their current state.

## Start With Five Fields

Getting metadata right is the foundation for a vault that scales. Write down five property names, put them in a template, and run one Dataview or Bases query this week to prove they work. That's the base layer of a [second brain in Obsidian](/blog/how-to-automate-your-second-brain).

To take the first pass on hundreds of imported notes, install [Note Companion](https://www.notecompanion.ai): drop notes in its inbox folder to have them tagged, renamed and filed, or open any note for tag and folder suggestions you approve.
