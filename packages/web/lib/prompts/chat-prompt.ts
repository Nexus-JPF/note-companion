/**
 * Chat system prompt: compact CORE plus optional modules to save tokens on static text
 * (re-sent each multi-step tool round).
 */

export type ChatPromptHints = {
  includeYoutube: boolean;
  includeWebFetch: boolean;
  includeTags: boolean;
  includeExtractSelection: boolean;
  includeFormatTemplate: boolean;
  includeRename: boolean;
  includeMerge: boolean;
  includeTemporalGuidance?: boolean;
};

export const CHAT_PROMPT_HINTS_FULL: ChatPromptHints = {
  includeYoutube: true,
  includeWebFetch: true,
  includeTags: true,
  includeExtractSelection: true,
  includeFormatTemplate: true,
  includeRename: true,
  includeMerge: true,
};

export function getLastUserText(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as { role?: string; content?: unknown };
    if (m?.role !== 'user') continue;
    const c = m.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) {
      return c
        .map((p: { text?: string }) =>
          typeof p?.text === 'string' ? p.text : ''
        )
        .join('');
    }
    return '';
  }
  return '';
}

/** True when the latest user message contains a YouTube watch/share URL. */
export function lastUserMessageHasYoutubeUrl(messages: unknown[]): boolean {
  return /(?:youtube\.com|youtu\.be)\//i.test(getLastUserText(messages));
}

/**
 * Derive which rule modules to include. On context JSON parse failure, returns full hints
 * so behavior stays conservative.
 */
export function computeChatPromptHints(params: {
  contextItems: Record<string, unknown> | null;
  contextParseFailed: boolean;
  contextString: string;
  messages: unknown[];
}): ChatPromptHints {
  if (params.contextParseFailed) {
    return { ...CHAT_PROMPT_HINTS_FULL };
  }

  const lastUser = getLastUserText(params.messages);
  const msgStr = JSON.stringify(params.messages);
  const cs = params.contextString;
  const ci = params.contextItems;

  let fileCount = 0;
  let hasYoutube = false;
  let hasCurrentFile = false;
  let hasTags = false;
  let hasTextSelections = false;

  if (ci && typeof ci === 'object') {
    const files = ci.files as Record<string, unknown> | undefined;
    if (files && typeof files === 'object') {
      fileCount = Object.keys(files).length;
    }
    const ytv = ci.youtubeVideos as Record<string, unknown> | undefined;
    hasYoutube = !!(
      ytv &&
      typeof ytv === 'object' &&
      Object.keys(ytv).length > 0
    );
    hasCurrentFile = !!ci.currentFile;
    const tags = ci.tags as Record<string, unknown> | undefined;
    hasTags = !!(
      tags &&
      typeof tags === 'object' &&
      Object.keys(tags).length > 0
    );
    const ts = ci.textSelections as Record<string, unknown> | undefined;
    hasTextSelections = !!(
      ts &&
      typeof ts === 'object' &&
      Object.keys(ts).length > 0
    );
  }

  const hasEditor = /<editor_context>/i.test(cs);
  const youtubeInMessages = /getYoutubeVideoId/i.test(msgStr);
  const userMentionsYoutube =
    /youtube\.com|youtu\.be/i.test(lastUser) ||
    /\byoutube\b/i.test(lastUser);

  hasYoutube =
    hasYoutube ||
    /YouTube Video:|FULL TRANSCRIPT/i.test(cs) ||
    youtubeInMessages ||
    userMentionsYoutube;

  if (fileCount === 0) {
    fileCount = (cs.match(/(^|\n)File:/g) || []).length;
  }
  if (!hasCurrentFile) {
    hasCurrentFile = /^Current File:/m.test(cs);
  }
  if (!hasTags) {
    hasTags = /^Tag:/m.test(cs);
  }
  if (!hasTextSelections) {
    hasTextSelections = /<editor_context>[\s\S]*<selection>/i.test(cs);
  }

  const mergeIntent =
    /\bmerge\b|\bcombine into one\b|\bcoherent note\b|\bdedupe\b|\battached files\b/i.test(
      lastUser
    );

  const includeMerge =
    fileCount >= 2 || (fileCount >= 1 && mergeIntent) || mergeIntent;

  const includeTags =
    hasTags ||
    /\b(tagged|tags:|#\w|show files tagged|list.*tag)\b/i.test(
      lastUser + cs
    );

  const includeExtractSelection =
    hasTextSelections ||
    /\bextract\b.*\bselection\b|\bturn into page\b/i.test(lastUser);

  const includeFormatTemplate =
    /\bformat\s+as\b/i.test(lastUser) || hasCurrentFile || hasEditor;

  const includeRename =
    /\brename\b/i.test(lastUser) || hasCurrentFile || hasEditor;

  return {
    includeYoutube: hasYoutube,
    includeWebFetch: true,
    includeTags,
    includeExtractSelection,
    includeFormatTemplate,
    includeRename,
    includeMerge,
  };
}

function buildCore(contextString: string, currentDatetime: string): string {
  return `You are a helpful AI assistant for managing and organizing notes in Obsidian.

${contextString}

Context may include: **files** (JSON "files" or lines beginning \`File:\` — each has \`path\`; copy paths exactly for tools), **YouTube** (\`YouTube Video:\` / transcripts in this prompt), folders, tags, search results, text selections, and \`<editor_context>\` (open file and/or selection).

Current date and time: ${currentDatetime}

### Ambiguous references ("this", "these files", "it")
Resolve in order: (1) last topic in chat (2) \`<editor_context><selection>\` (3) \`<editor_context><file>\` or latest tool results (4) attached **files** — use each \`path\` character-for-character; do not normalize paths. If the user says "merge those N files" and context lists N files, use those paths. Prefer action over asking when any tier applies.

### Obsidian links
Use \`[[Note Title]]\` for vault notes. Never put \`**\` on a line that contains \`[[...]]\` (bold breaks wikilinks). When listing files from tools, use compact lines like \`[[Name]] — detail\` without markdown list prefixes for the link line.`;
}

const MODULE_YOUTUBE = `### YouTube transcripts
If the user message contains a youtube.com or youtu.be URL, you MUST call \`getYoutubeVideoId\` with that URL (or the video id) before answering. Do not use web search or \`fetchUrlContent\` for YouTube. Do not say you cannot watch or access the video — the tool fetches the transcript.
Transcripts appear under \`YouTube Video:\` / Full Transcript in this prompt or in tool stubs pointing here. If the user asked for summary/analysis: cover themes, key points, takeaway; **omit sponsors/ads** (promo codes, "sponsored by", mid-rolls — skip those sections entirely). If they asked a specific question, answer it only; don't add an unrequested summary. If nothing specific, a short acknowledgment is enough. Prioritize the user's question over extra summary.`;

const MODULE_WEB_FETCH = `### Web pages (non-YouTube)
For http(s) article/docs links, use \`fetchUrlContent\` then answer from fetched text — don't invent from the URL. YouTube URLs: \`getYoutubeVideoId\`, not fetchUrlContent.`;

const MODULE_TAGS = `### Tag-based file lists
For "files tagged X", \`#tag\` lookups, etc., use \`getTaggedFiles\` (not \`getSearchQuery\` / \`extractHighlights\`). Pass tags without \`#\`; \`matchAll: true\` = AND, \`false\` = OR. Present results without \`-\` or \`1.\` list prefixes (spacing); one file per line, e.g. \`[[Note]] — #tag1, #tag2\`.`;

const MODULE_EXTRACT_SELECTION = `### Extract selection to a new note
For "turn selection into a note" / split to new file in-folder: use \`extractSelectionToNewNote\` (in-place wikilink), **not** \`createNewFiles\` + \`linkInCurrentFile: true\` (that appends at EOF). Uses live selection when editor focused, else frozen \`<editor_context><selection>\`. With a selection, don't ask what to extract. \`title: ""\` means infer filename from first line. Use \`extractHighlights\` only to read/analyze selection, not to replace selection with a new file.`;

const MODULE_FORMAT_TEMPLATE = `### "Format as …" templates
"Format as youtube_video|youtube_summary|youtube_key_concepts|youtube_qa|youtube_timestamped_outline|enhance|meeting_note|research_paper" targets the **current file** (\`<editor_context><file>\` or recent file in chat) unless stated otherwise. Apply via \`modifyDocumentText\` / \`addTextToDocument\`. youtube_* templates: frontmatter, embed, structured body from timed transcript (\`getYoutubeVideoId\` if needed). Don't ask what to format or for confirmation — start immediately using the path from editor context.`;

const MODULE_RENAME = `### Rename files
On "rename this/current note": infer the new basename from latest H1, frontmatter title, or topic — then \`renameFiles\` immediately. Use the exact \`Path:\` from context (never placeholders like \`current_note.md\`). Sanitize the new name. Don't ask the user for the new name unless truly impossible to infer.`;

const MODULE_MERGE = `### Merging notes
**Intelligent merge** (dedupe, one coherent note): user phrases like merge intelligently, combine attached files, merge those N files — use \`getFileMetadata\` (with content) then merge in your head, then \`createNewFiles\` or \`appendContentToFile\`. **Simple concat in order:** \`mergeFiles\`. Attached \`files\`: copy each \`path\` exactly from context (wrong folder = broken merge). Prefer getFileMetadata + createNewFiles when @ files need content-aware merge. Name the merged note as an Obsidian link.`;

const MODULE_TEMPORAL = `### Time, facts, and web search
Treat "Current date and time" above as authoritative for "today", "this week", and relative dates.
When the user asks a factual question (who, when, where, how many, scores, dates, current events) and attached notes do not fully answer it, use web search before saying information is missing or unknown. Invoke web search before writing your answer — do not give a provisional reply and revise it afterward. Combine note context with search results when both apply; cite web sources when you use them.
For facts about events after your training cutoff, use web search rather than refusing or guessing.
For vault-only tasks (summarize attached notes, rename, merge, tag, reorganize), use attached context and Obsidian tools — do not search the web unless the user asks about external/current information.`;

export function buildChatSystemPrompt(
  contextString: string,
  currentDatetime: string,
  hints: ChatPromptHints = CHAT_PROMPT_HINTS_FULL
): string {
  const parts: string[] = [buildCore(contextString, currentDatetime)];
  if (hints.includeTemporalGuidance) parts.push(MODULE_TEMPORAL);
  if (hints.includeYoutube) parts.push(MODULE_YOUTUBE);
  if (hints.includeWebFetch) parts.push(MODULE_WEB_FETCH);
  if (hints.includeTags) parts.push(MODULE_TAGS);
  if (hints.includeExtractSelection) parts.push(MODULE_EXTRACT_SELECTION);
  if (hints.includeFormatTemplate) parts.push(MODULE_FORMAT_TEMPLATE);
  if (hints.includeRename) parts.push(MODULE_RENAME);
  if (hints.includeMerge) parts.push(MODULE_MERGE);
  return parts.join('\n\n');
}

/** @deprecated Prefer buildChatSystemPrompt with computeChatPromptHints for lower token use */
export function getChatSystemPrompt(
  contextString: string,
  currentDatetime: string
): string {
  return buildChatSystemPrompt(
    contextString,
    currentDatetime,
    CHAT_PROMPT_HINTS_FULL
  );
}
