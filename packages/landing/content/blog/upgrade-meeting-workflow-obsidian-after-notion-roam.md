---
title: 'Obsidian Meeting Notes After Notion or Roam'
slug: 'upgrade-meeting-workflow-obsidian-after-notion-roam'
date: '2026-11-14'
category: 'Guides'
tags: ['obsidian', 'pkm', 'meetings', 'transcription', 'summarization']
excerpt: 'Transcribe meeting audio in Obsidian, then file a summary and action items. A workflow after Notion or Roam, plus what Note Companion does.'
image: '/blog/images/upgrade-meeting-workflow-obsidian-after-notion-roam.webp'
faq:
  - question: 'Can I use this Obsidian meeting workflow if I only have notes, not audio?'
    answer: >-
      Yes. Capture the notes in an inbox folder, then summarize outcomes and action items in a processed meeting note. Transcription is optional.
  - question: 'What if I have a backlog of old transcripts from Notion or Roam?'
    answer: >-
      Import them into your inbox folder and process a few at a time. You do not need to transcribe them again if you already have the text.
  - question: 'How do I handle confidential meeting content in Obsidian?'
    answer: >-
      Obsidian stores notes on your device. Note Companion sends audio to its servers for transcription (OpenAI by default, or your own endpoint if you self-host). If recordings must stay off third-party servers, self-host the backend and review the privacy policy.
---

## Rethinking Meetings in Obsidian: Why Summaries Matter More Than Ever

Switching from Notion or Roam to Obsidian often means leaving behind slick block references and databases for a more flexible, file-based approach. While this opens up new customization opportunities, it also means you need reliable workflows for capturing and distilling meeting knowledge, especially if you’re used to searching, tagging, and referencing meeting content in different ways.

Meetings flood you with information: spoken ideas, decisions, and next steps. Without a workflow, these insights end up buried in raw transcripts or scattered notes. The goal is to quickly convert conversations into actionable, connected knowledge, without the overhead of manual reorganization.

This guide lays out a practical, Obsidian-first workflow that transforms meeting audio into focused summaries, action lists, and tightly linked notes, making your vault a true knowledge hub, not just a text graveyard.

**Short answer:** Record the meeting, transcribe the audio into a note, then write a short summary and action list in a processed meeting note you can link and tag. In Note Companion, drop audio into `_NoteCompanion/Inbox` to transcribe and file it, or use Enhance note in the Meetings tab. Transcription runs on Note Companion's servers unless you self-host.

## Setting Up: Folders, Templates, and Naming That Work

Before you dive into your next meeting, invest ten minutes to build a vault structure that minimizes friction and mirrors some of the best parts of your old workflow.

- **Inbox for raw material:** Create `inbox/`, your drop zone for unprocessed transcripts and audio. This replaces the "quick capture" flow from Notion and Roam, but with a clear separation between capture and processing. For habits that keep that folder from overflowing, see [tame your Obsidian inbox](/blog/tame-obsidian-inbox-across-devices-ai-organization).
- **Meetings folder:** Set up `meetings/` for finalized notes and summaries. This gives you a single location for all processed meetings.
- **Templates for consistency:** Use the Templates core plugin to build a meeting note template. Include:
  - Date
  - Attendees
  - Purpose
  - Link to transcript/audio
  - Summary
  - Action items
  - Tags

**Example file naming:**
- Raw: `inbox/2026-06-02-product-standup-transcript.md`
- Processed: `meetings/2026-06-02-product-standup.md`

This separation makes it easy to spot which meetings need attention and which are ready for review.

## Step 1: Capture: From Audio to Raw Transcript

Your first challenge is getting meeting content into your vault. Here’s a streamlined approach:

1. **Record** the meeting using your preferred tool (Zoom, Teams, Otter, or even your phone).
2. **Transcribe:** Export a text file from your recorder, or use Note Companion. Drop the audio into `_NoteCompanion/Inbox` (the default watch folder) and it will transcribe, rename and file the note. Recordings made in the Meetings tab go to `Recordings/` unless you turn on "Send recordings to inbox."
3. **Quick review:** Glance over the raw file to confirm the main content is captured. Optionally, include a link to the original recording for reference.

See also [making large-file transcription reliable](/blog/making-large-file-transcription-reliable-for-end-users).

Keep the notes themselves in your vault. If you use Note Companion to transcribe, the audio is sent to its transcription service unless you self-host.

## Step 2: Process: Turning Transcripts into Actionable Notes

Raw transcripts are rarely useful on their own. The real value comes from distilling the important details and action items. Here’s how to do it efficiently:

### Manual Processing

- **Highlight:** As you read, use Obsidian’s highlight syntax (`==important==`) or comments to mark key statements and decisions.
- **Summarize:** Create a new note in `meetings/` from your template. Under the **Summary** section, boil the discussion down to bullet points: focus on outcomes, not chatter.
- **Action Items:** Add a checklist for tasks and assignments.
- **Link:** Use wikilinks (e.g., `[[Q3 Marketing Plan]]`, `[[Alice Johnson]]`) to connect the meeting to projects and people.

### Fast-Track with AI

- Drop the audio into `_NoteCompanion/Inbox` and Note Companion transcribes, renames and files the note.
- On an open transcript, the Organizer suggests tags and a folder, and applies nothing until you click.
- To get a structured summary (discussion points, action items, decisions), use **Enhance note** in the Meetings tab, then edit the result.

**Sample processed meeting note:**

```markdown
## Summary
- Finalized social media strategy for Q3
- Assigned blog post topics to team members
- Agreed to pilot new SEO tool

## Action Items
- [ ] Lisa to share draft calendar by Friday
- [ ] Mark to test SEO tool and report findings
```

## Step 3: Connect: Linking, Tagging, and Contextualizing

Don’t let meeting notes become isolated. Obsidian’s linking and tag features make it easy to weave meetings into your broader PKM system:

- **Wikilinks:** Link to related projects (`[[Client Redesign]]`), people (`[[Jordan Lee]]`), or research topics.
- **Tags:** Apply consistent tags like `#meeting`, `#action-item`, or project-specific tags for fast filtering.
- **Backlinks:** Use Obsidian’s backlinks pane to see all meetings tied to a topic or contact.
- **Periodic reviews:** Schedule a weekly review of your `inbox/` to keep the flow moving and ensure nothing slips through the cracks. A fuller ritual is in [from inbox chaos to vault clarity](/blog/from-inbox-chaos-to-vault-clarity-weekly-review-obsidian-rituals).

## Real-World Example: Migrating Research Meetings from Roam (made-up example)

Consider Alex, a PhD student who used Roam’s block references and daily notes to log lab meetings and research huddles. After switching to Obsidian, Alex wants to replicate fast capture while gaining better long-term organization.

Here’s Alex’s approach:
- Records meetings via Zoom and saves the audio to a synced folder.
- Uses Note Companion by dropping each Zoom recording into `_NoteCompanion/Inbox`, which transcribes it and files the note.
- Highlights key findings and tasks in the transcript.
- Creates a new note in `meetings/` using the meeting template, summarizes findings, and adds action items.
- Links the meeting note to ongoing research projects like `[[Protein Expression Study]]` and tags it with `#lab-meeting`.
- During weekly reviews, checks for outstanding action items and ensures all raw transcripts are processed and filed.

Alex finds this system less cluttered than Roam, while still supporting quick capture and effortless retrieval.

## Checklist: Streamlined Meeting Workflow in Obsidian

- [ ] Record meeting audio
- [ ] Drop audio into `_NoteCompanion/Inbox` for Note Companion transcription, or export text from another tool
- [ ] Save raw transcript to `inbox/`
- [ ] Highlight and annotate key points
- [ ] Create processed meeting note in `meetings/`
- [ ] Summarize key outcomes
- [ ] Extract and list action items
- [ ] Link to relevant projects and people
- [ ] Tag notes consistently (e.g., #meeting, #action-item)
- [ ] Review `inbox/` weekly to process new content

## Tips for a Frictionless Migration

- Embrace folders and tags: They replace databases and blocks for organizing and retrieving meeting knowledge.
- Automate where it saves time: use Note Companion to transcribe inbox audio, and review any Meetings-tab enhancement before you treat it as final.
- Standardize with templates: Consistency makes reviewing and searching much easier.
- Don’t let transcripts pile up: A weekly review habit keeps your `inbox/` clear and your meeting notes actionable.
- Connect your notes: The more you link meetings to projects and people, the more valuable your vault becomes over time.

---

Migrating to Obsidian doesn’t mean giving up robust meeting workflows. With a little setup and the right tools, you’ll turn chaotic transcripts into clear, actionable notes, making every meeting a lasting asset in your PKM vault.
