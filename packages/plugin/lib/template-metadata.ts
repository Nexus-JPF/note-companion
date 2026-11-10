const TEMPLATE_HINTS: Record<string, string> = {
  youtube_video:
    "Full notes with a detailed summary and optional [MM:SS] bullets — best default for most videos.",
  youtube_summary:
    "Short recap and key takeaways — use when you want a quick read, not full coverage.",
  youtube_key_concepts:
    "Concepts as ### headings — good for learning themes and reviewing ideas.",
  youtube_qa:
    "Question-and-answer pairs — use for study notes and self-testing.",
  youtube_timestamped_outline:
    "Hierarchical outline with timestamps — best for skimming long videos or jumping to sections.",
  meeting_note:
    "Discussion points and action items from meeting transcripts or notes.",
  research_paper:
    "Structured academic summary with methodology, findings, and citations.",
  flash_cards:
    "Interactive flashcards using Obsidian details/summary blocks.",
  lecture_notes:
    "Study notes from a lecture or class recording: summary, key concepts, details, review questions, assignments.",
  enhance:
    "Improve headings, lists, and structure without rewriting the content.",
};

function normalizeTemplateName(templateName: string): string {
  return templateName.replace(/\.md$/i, "").trim().toLowerCase();
}

/** Short user-facing description for the Organizer template picker. */
export function getTemplateDisplayHint(templateName: string): string | undefined {
  return TEMPLATE_HINTS[normalizeTemplateName(templateName)];
}
