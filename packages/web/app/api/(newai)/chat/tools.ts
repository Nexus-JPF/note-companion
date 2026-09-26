import { z } from 'zod';

/** Trimmed tool schemas (~15kB file); count describe strings ~4–8k depending on regex. */
const settingsSchema = z.object({
  renameInstructions: z
    .string()
    .describe('Rename rules; empty = none'),
  customFolderInstructions: z
    .string()
    .describe('Folder rules; empty = defaults'),
  imageInstructions: z
    .string()
    .describe('Image handling; empty = defaults'),
});

export const chatTools = {
  getSearchQuery: {
    description: 'Semantic vault search by meaning',
    parameters: z.object({
      query: z.string().describe('Search query'),
    }),
  },
  searchByName: {
    description: 'Find notes by filename pattern or exact name',
    parameters: z.object({
      query: z
        .string()
        .describe("Pattern or name, e.g. 'Untitled*', 'daily-*'"),
    }),
  },
  openFile: {
    description: 'Open a vault file in the workspace',
    parameters: z.object({
      filePath: z.string().describe("Path e.g. 'folder/note.md'"),
    }),
  },
  getYoutubeVideoId: {
    description:
      'YouTube transcript into context; then summarize. Not for generic http URLs.',
    parameters: z.object({
      videoId: z
        .string()
        .describe("Video ID or youtube.com / youtu.be URL"),
    }),
  },
  fetchUrlContent: {
    description:
      'Fetch readable text from an http(s) page (not YouTube—use getYoutubeVideoId).',
    parameters: z.object({
      url: z.string().describe('Full URL'),
    }),
  },
  getLastModifiedFiles: {
    description: 'Recently modified markdown files',
    parameters: z.object({
      count: z.number().describe('How many files'),
    }),
  },
  appendContentToFile: {
    description: 'Append markdown to an existing note',
    parameters: z.object({
      content: z.string().describe('Markdown to append'),
      message: z.string().describe('What is being added'),
      fileName: z
        .string()
        .describe('Target path, or "" for active file'),
    }),
  },
  createLink: {
    description:
      'Insert wikilink: source → target. sourcePath "" = active file.',
    parameters: z.object({
      sourcePath: z
        .string()
        .describe('From note path; "" = active file'),
      targetPath: z.string().describe('To note path or title'),
      alias: z
        .string()
        .describe('[[target|alias]] text; "" = none'),
      message: z.string().describe('Brief reason'),
    }),
  },
  addTextToDocument: {
    description: 'Add a section/block to a note',
    parameters: z.object({
      content: z.string().describe('Markdown'),
      path: z.string().describe('File path; omit/empty = active file'),
    }),
  },
  modifyDocumentText: {
    description: 'Replace or rewrite note body (selection or whole file)',
    parameters: z.object({
      content: z.string().describe('New markdown'),
      path: z.string().describe('Path; empty = active file'),
      instructions: z
        .string()
        .describe('How to edit; optional'),
    }),
  },
  generateSettings: {
    description: 'Propose organizer settings from preferences',
    parameters: settingsSchema,
  },
  analyzeVaultStructure: {
    description:
      'Onboarding: scan folder tree and suggest organization',
    parameters: z.object({
      path: z.string().describe("Root '/' or subfolder"),
      maxDepth: z
        .number()
        .describe('Folder depth; 0 = unlimited'),
    }),
  },

  moveFiles: {
    description: 'Bulk move files matching pattern into folders',
    parameters: z.object({
      moves: z.array(
        z.object({
          sourcePath: z.string().describe("Source folder or '/'"),
          destinationPath: z.string().describe('Destination folder'),
          pattern: z.object({
            namePattern: z
              .string()
              .describe("Glob-like name, e.g. 'daily-*'; empty = all"),
            extension: z
              .string()
              .describe("e.g. 'md'; empty = all"),
          }),
        })
      ),
      message: z.string().describe('Plan summary'),
    }),
  },
  renameFiles: {
    description:
      'Rename notes (Obsidian title = basename). Infer newName from latest H1/heading if user vague. Current file: oldPath must match exact "Path:" from Current File context—never placeholders like current_note.md. Shape: { files: [{ oldPath, newName }], message }—message top-level only.',
    parameters: z.object({
      files: z
        .array(
          z.object({
            oldPath: z
              .string()
              .describe(
                'Full path now; for active file use context Path exactly'
              ),
            newName: z
              .string()
              .describe('New title without .md; filesystem-safe'),
          })
        )
        .describe('Only oldPath + newName per item'),
      message: z
        .string()
        .describe('Why / naming strategy; top-level only'),
    }),
  },
  executeActionsOnFileBasedOnPrompt: {
    description: 'Tag, move, or rename many files from content heuristics',
    parameters: z.object({
      filePaths: z.array(z.string()).describe('Paths to process'),
      userPrompt: z.string().describe('What to optimize'),
    }),
  },

  getFileMetadata: {
    description:
      'Frontmatter, tags, links, dates; optional full body for merge workflows',
    parameters: z.object({
      filePaths: z.array(z.string()).describe('Files'),
      includeContent: z.boolean().describe('Include body; default false'),
      includeFrontmatter: z.boolean().describe('Default true'),
      includeTags: z.boolean().describe('Default true'),
      includeLinks: z.boolean().describe('Default true'),
      includeBacklinks: z.boolean().describe('Default false'),
    }),
  },

  updateFrontmatter: {
    description: 'Add/update/delete YAML frontmatter keys',
    parameters: z.object({
      filePath: z.string().describe('File path'),
      updatesJson: z
        .string()
        .describe('JSON object of keys to set, or "{}"'),
      deletions: z
        .array(z.string())
        .describe('Keys to remove'),
      message: z.string().describe('Change summary'),
    }),
  },

  addTags: {
    description: 'Add tags in frontmatter and/or inline',
    parameters: z.object({
      filePaths: z.array(z.string()).describe('Targets'),
      tags: z
        .array(z.string())
        .describe("No # prefix, e.g. ['idea']"),
      location: z
        .enum(['frontmatter', 'inline', 'both'])
        .describe('Where to write'),
      inlinePosition: z
        .enum(['top', 'bottom'])
        .describe('Inline placement'),
      message: z.string().describe('Why these tags'),
    }),
  },

  getBacklinks: {
    description: 'Incoming wikilinks to given files',
    parameters: z.object({
      filePaths: z.array(z.string()).describe('Targets'),
      includeUnresolved: z
        .boolean()
        .describe('Include unresolved; default false'),
    }),
  },

  getOutgoingLinks: {
    description: 'Outgoing links/embeds from files',
    parameters: z.object({
      filePaths: z.array(z.string()).describe('Sources'),
      includeEmbeds: z.boolean().describe('Default true'),
      resolvedOnly: z.boolean().describe('Default false'),
    }),
  },

  getHeadings: {
    description: 'Outline (H1–H6) for files',
    parameters: z.object({
      filePaths: z.array(z.string()).describe('Files'),
      minLevel: z.number().min(1).max(6).describe('Min level; default 1'),
      maxLevel: z.number().min(1).max(6).describe('Max level; default 6'),
    }),
  },

  getTaggedFiles: {
    description:
      'Find files by tag(s); prefer over text search for tags',
    parameters: z.object({
      tags: z.array(z.string()).describe('Without #'),
      matchAll: z
        .boolean()
        .describe('true = AND, false = OR'),
      excludeTags: z
        .array(z.string())
        .describe('Exclude; [] if none'),
      folder: z
        .string()
        .describe('Scope folder; "" = vault'),
    }),
  },

  findBrokenLinks: {
    description: 'Unresolved [[links]] in vault, folder, or listed files',
    parameters: z.object({
      folder: z
        .string()
        .describe('Scope; "" = vault; ignored if filePaths set'),
      filePaths: z
        .array(z.string())
        .describe('Files to scan; [] = use folder/vault'),
      groupBySource: z
        .boolean()
        .describe('Group by source file; default true'),
      limit: z
        .number()
        .min(1)
        .max(200)
        .describe('Max entries; truncated with total'),
    }),
  },

  extractHighlights: {
    description:
      'Read selection, one file, or many for quotes/highlights. Use paths from context for @ / current file.',
    parameters: z.object({
      scope: z
        .enum(['selection', 'document', 'files'])
        .describe('selection | document | files'),
      filePath: z
        .string()
        .describe('document scope: path or "" = active'),
      filePaths: z
        .array(z.string())
        .describe('files scope; else []'),
      maxChars: z
        .number()
        .describe('Per-file cap; default 30000'),
    }),
  },

  extractSelectionToNewNote: {
    description:
      'New note from frozen editor selection; replace selection with link. Title "" = infer from first line.',
    parameters: z.object({
      title: z
        .string()
        .describe('Name sans .md; "" = infer from selection'),
      message: z.string().describe('Short reason'),
    }),
  },

  createNewFiles: {
    description: 'Create one or many notes; optional wikilinks from active file',
    parameters: z.object({
      files: z
        .array(
          z.object({
            fileName: z.string().describe('Basename without .md'),
            content: z.preprocess((val) => {
              if (typeof val !== 'string') return val;
              if (!val) return val;
              return val
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\r/g, '\r')
                .replace(/\\\\/g, '\\');
            }, z.string().describe('Markdown body')),
            folder: z.string().describe('Folder under vault; "" = root'),
          })
        )
        .describe('Files to create'),
      linkInCurrentFile: z
        .boolean()
        .describe('Link new notes from active file; default true'),
      message: z.string().describe('Why these files'),
    }),
  },

  deleteFiles: {
    description: 'Delete paths (confirm in UI; files move to trash)',
    parameters: z.object({
      filePaths: z.array(z.string()).describe('Paths'),
      reason: z.string().describe('Why delete'),
    }),
  },

  mergeFiles: {
    description:
      'Concat files in order. Smart merge: getFileMetadata+content then createNewFiles.',
    parameters: z.object({
      sourceFiles: z.array(z.string()).describe('Ordered paths'),
      outputFileName: z.string().describe('Output basename sans .md'),
      outputFolder: z.string().describe('Folder; default root'),
      separator: z
        .string()
        .describe("Between files; default '\\n\\n---\\n\\n'"),
      deleteSource: z.boolean().describe('Delete sources after'),
      message: z.string().describe('Purpose'),
    }),
  },

  createTemplate: {
    description: 'Save a reusable template note',
    parameters: z.object({
      templateName: z.string().describe('Basename sans .md'),
      templateContent: z
        .string()
        .describe('Body; may use {{date}} etc.'),
      templateFolder: z.string().describe("Folder; default 'Templates'"),
      description: z.string().describe('Human description'),
      message: z.string().describe('Usage note'),
    }),
  },

  bulkFindReplace: {
    description: 'Find/replace across listed files',
    parameters: z.object({
      filePaths: z.array(z.string()).describe('Targets'),
      find: z.string().describe('Literal or regex if useRegex'),
      replace: z.string().describe('Replacement'),
      useRegex: z.boolean().describe('Default false'),
      caseSensitive: z.boolean().describe('Default true'),
      message: z.string().describe('What changes'),
    }),
  },

  exportToFormat: {
    description: 'Export notes to pdf, html, or txt',
    parameters: z.object({
      filePaths: z.array(z.string()).describe('Sources'),
      format: z.enum(['pdf', 'html', 'txt']).describe('Kind'),
      outputFolder: z.string().describe("Default 'Exports'"),
      includeMetadata: z.boolean().describe('Frontmatter in export'),
      message: z.string().describe('Why export'),
    }),
  },

  searchScreenpipe: {
    description:
      'Screen/audio activity via Screenpipe (OCR + transcripts). Listen/meetings/audio: content_type audio or all; vague query: one broad call, limit 30–40, window_name "" for all Chrome tabs. "today": start_time = today 00:00 UTC, end_time = now—never empty for today; filter results to that calendar day. Meetings: prefer audio + optional all; reply only meeting-like rows. app_name = real macOS app (Google Chrome for websites); window_name = site (YouTube) or "" . Dual desktop+browser: e.g. GitHub Desktop + Chrome/GitHub. Group same app+window. YouTube site: Chrome + window YouTube—not app_name YouTube.',
    parameters: z.object({
      q: z
        .string()
        .describe('Keywords; "" for broad/recent'),
      content_type: z
        .enum(['all', 'ocr', 'audio'])
        .describe(
          'Meetings: audio first; listen queries: audio; else all'
        ),
      limit: z
        .number()
        .min(1)
        .max(50)
        .describe('Rows; 10 default, up to 50 if user wants all'),
      start_time: z
        .string()
        .describe(
          'ISO UTC start; today queries need midnight UTC—not ""'
        ),
      end_time: z
        .string()
        .describe('ISO UTC end; today = now'),
      app_name: z
        .string()
        .describe(
          'e.g. Google Chrome, Slack, zoom.us; "" if any'
        ),
      window_name: z
        .string()
        .describe(
          'Window filter e.g. YouTube; "" for all Chrome tabs'
        ),
    }),
  },
} as const;

export type ChatToolsMode = 'full';

/**
 * Expand with product-defined modes later; keep default full for compatibility.
 */
export function buildChatToolsForMode(_mode: ChatToolsMode = 'full'): typeof chatTools {
  return chatTools;
}

type V5ToolFactory = (def: {
  description: string;
  inputSchema: z.ZodTypeAny;
}) => unknown;

/**
 * Wrap the shared Zod schemas for AI SDK 5 (`inputSchema`, no execute).
 * The v5 route injects `tool` from `ai-v5` so this file never imports SDK 5.
 */
export function buildV5ChatTools(toolFactory: V5ToolFactory): Record<string, unknown> {
  const tools: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(chatTools)) {
    tools[name] = toolFactory({
      description: def.description,
      inputSchema: def.parameters,
    });
  }
  return tools;
}
