# Note Companion - AI Agents Development Guide

## Overview

This document provides comprehensive guidance for AI agents (like Claude, GPT-4, etc.) working on the Note Companion codebase. It contains critical architectural decisions, code patterns, and development workflows that must be understood before making changes.

---

## Project Architecture

### Core Philosophy
Note Companion is a **document transcription and organization system** that bridges analog and digital content. The primary goal is to help users effortlessly convert physical/analog materials (handwritten notes, PDFs, voice memos) into searchable, organized digital text within their Obsidian vault.

### Package Structure

The project is a **monorepo** with four main packages:

1. **`packages/plugin/`** - Obsidian plugin (TypeScript)
   - Core file organization logic
   - Inbox monitoring and processing
   - UI integration with Obsidian
   - Event handling and record management

2. **`packages/web/`** - Next.js web application (TypeScript/React)
   - User authentication (Clerk)
   - Billing/subscriptions (Stripe)
   - AI processing endpoints
   - Database operations (Drizzle ORM)
   - API services

3. **`packages/mobile/`** - Mobile application (React Native/Expo)
   - Cross-platform iOS/Android app
   - File capture and upload
   - OAuth authentication
   - Background sync
   - Share Sheet integration

4. **`packages/landing/`** - Marketing website (Next.js)
   - Public-facing website
   - Tutorial and documentation pages

---

## AI Model Recommendations

**Use these models for specific tasks:**
- **o3-mini** - For complex reasoning and architectural decisions
- **claude-3-5-sonnet-20241022** - For PDF extraction, document processing, and content analysis

---

## Critical Implementation Guidelines

### 1. Styling System (CRITICAL - READ FIRST)

**Problem:** Obsidian plugin environment has CSS conflicts with standard frameworks.

**Solution:** Use **theme-agnostic, native Obsidian styling** approach:

---

#### The Obsidian Native Protocol

**Role:** You are an Obsidian Plugin UI Specialist. Your goal is to generate HTML/CSS that is **indistinguishable from the core application**.

**Golden Rule:** "Invisible Design." If the component looks like a distinct 'widget,' you have failed. It must look like it shipped with the core app.

---

#### The 3 Immutable Laws

**1. No Hardcoded Colors**
- ❌ FORBIDDEN: Hex codes (`#fff`, `#333`), standard colors (`red`, `blue`, `gray-800`)
- ✅ REQUIRED: Obsidian CSS variables (`var(--text-normal)`, `var(--background-primary)`)
- **Why:** Hardcoded colors break user themes. A "Minimal" theme user will see your component as bloated. A "Cyberpunk" theme user will see it as broken.

**2. No "Container Drift"**
- ❌ FORBIDDEN: Cards with shadows, distinct background colors, heavy borders
- ✅ REQUIRED: Whitespace and subtle borders (`1px solid var(--background-modifier-border)`)
- **Why:** Obsidian uses flat, borderless design. Drop shadows and colored containers look foreign.

**3. Density is Quality**
- ❌ FORBIDDEN: "Airy" layouts with excessive padding (>24px empty space)
- ✅ REQUIRED: Tight lists (32px row height), small fonts, high information density
- **Why:** Obsidian is an IDE for thought. Users expect dense, efficient layouts like VS Code.

---

#### Configuration
- Tailwind configured with custom Obsidian CSS variables
- Preflight disabled to avoid global style conflicts
- Component isolation through `StyledContainer` wrapper
- **NO PREFIX needed** - removed `fo-` prefix to allow JIT compilation

---

#### Implementation Pattern (REQUIRED)

For **ALL new components** in the plugin:

```tsx
import { StyledContainer } from "../../components/ui/utils";
import { tw } from "../../lib/utils";

export function MyComponent() {
  return (
    <StyledContainer>
      {/* Use Obsidian CSS variables, not hardcoded colors */}
      <div className={tw("bg-[--background-primary] text-[--text-normal] p-2")}>
        {/* Component content */}
      </div>
    </StyledContainer>
  );
}
```

---

#### The Translation Layer (Web → Obsidian)

When building standard web components, translate them to Obsidian equivalents:

| Standard Web Pattern | Obsidian Native Equivalent | Implementation Rule |
|---------------------|---------------------------|---------------------|
| **Card** (Box w/ Shadow) | List Item (Flat row) | No background. `border-bottom: 1px`. Hover effect only. |
| **Dropdown** `<select>` | Suggester Modal | Do not build a `<select>`. Use read-only input that triggers modal. |
| **Primary Button** | Action Icon | Prefer clickable icon (`var(--icon-size)`) in header over big text button. |
| **Tag / Badge** | Pill | `var(--tag-background)`, `var(--tag-color)`, `border-radius: var(--radius-s)`. |
| **H1-H3 Titles** | Section Headers | `font-size: var(--font-ui-smaller)`, `font-weight: 600`, Uppercase, Muted color. |

---

#### The CSS Variable Cheat Sheet

**Use these variables strictly. Do not deviate.**

**1. Backgrounds & Surfaces**
```css
--background-primary         /* Main pane */
--background-secondary       /* Sidebar/Settings */
--background-modifier-form-field  /* Inputs/Textareas */
--background-modifier-hover  /* CRITICAL for interactivity */
--background-modifier-active-hover  /* Active/Selected state */
--background-modifier-border /* Separators (1px solid) */
```

**2. Typography & Text**
```css
--text-normal      /* Standard text */
--text-muted       /* Subtitles/Meta (timestamps, file paths) */
--text-error       /* Errors */
--text-accent      /* Accents/Links (use sparingly) */
--font-interface   /* Font family (Never set font-family manually) */
--font-ui-smaller  /* Smaller UI text */
```

**3. Borders & Icons**
```css
--background-modifier-border  /* Separator: 1px solid */
--radius-s        /* Small radius (usually 4px) */
--icon-size       /* Standard icon size */
```

**4. Interactive Elements**
```css
--interactive-accent       /* Clickable elements */
--interactive-accent-hover /* Hover state */
--tag-background          /* Tag background */
--tag-color               /* Tag text */
```

---

#### Key Rules (Revised)

1. **Always** wrap component root in `StyledContainer`
2. **Always** use `tw()` function for className merging
3. **Always** use Obsidian CSS variables (e.g., `bg-[--background-primary]`)
4. **Never** use hardcoded colors (`bg-white`, `bg-gray-800`, `#fff`)
5. **Never** use heavy shadows (`shadow-lg`, `drop-shadow`)
6. **Never** use excessive spacing (max 24px)
7. **Prefer** existing UI components from `components/ui/`
8. **Prefer** flat, borderless design with subtle hover states

---

#### Examples: Bad vs Good

**❌ BAD - Looks like a SaaS Dashboard:**
```tsx
<div className="bg-white shadow-lg rounded-xl p-6 m-4">
  <h2 className="text-2xl font-bold text-gray-900 mb-4">My Card</h2>
  <button className="bg-blue-500 text-white px-6 py-3 rounded-lg">
    Click Me
  </button>
</div>
```

**✅ GOOD - Looks like Obsidian Core:**
```tsx
<div className="border-b border-[--background-modifier-border] p-2 hover:bg-[--background-modifier-hover]">
  <div className="text-[--font-ui-smaller] font-semibold text-[--text-muted] uppercase mb-1">
    Section Header
  </div>
  <div className="flex items-center gap-2">
    <span className="text-[--text-normal]">Content</span>
    <button className="clickable-icon" aria-label="Action">
      <svg className="w-[--icon-size] h-[--icon-size]">...</svg>
    </button>
  </div>
</div>
```

---

#### The "0.001% Test" (Self-Correction)

Before outputting code, ask yourself:

✅ **Does this look like it belongs in VS Code?** → Keep it.  
❌ **Does this look like a SaaS dashboard?** → Reject it.  
❌ **Is there more than 24px of empty space anywhere?** → Tighten it.  
❌ **Did I use `bg-blue-500` or `shadow-lg`?** → Replace with Obsidian variables.  
✅ **Can I distinguish this from core Obsidian UI in a screenshot?** → If yes, you failed.

---

#### Available UI Components

**Pre-built Components** (use these when possible):
- Button (with Obsidian styling)
- Card (flat, no shadow)
- Dialog
- Badge (uses `--tag-background`)

**When to Build Custom:**
- Only if no existing component fits
- Follow Obsidian CSS variable rules strictly
- Test with multiple themes (Minimal, Default, Cyberpunk)

---

#### Troubleshooting Style Conflicts

1. Verify `StyledContainer` wrapper is present
2. Check all classNames use `tw()` function
3. Replace hardcoded colors with Obsidian CSS variables
4. Remove shadows and heavy borders
5. Reduce spacing to match Obsidian density
6. Test with different themes (Settings → Appearance → Themes)
7. Use browser dev tools to inspect and verify CSS variables apply
8. Compare side-by-side with core Obsidian UI elements

---

#### Testing Theme Compatibility

**Required Theme Tests:**
1. **Default Theme** - Base compatibility
2. **Minimal Theme** - Tests for bloat/overstyling
3. **Cyberpunk/Colorful Theme** - Tests for color handling
4. **Dark Theme** - Tests for contrast issues

**How to Test:**
1. Install theme via Settings → Appearance → Themes
2. Enable theme
3. Open your plugin component
4. Verify it blends seamlessly with surrounding UI
5. Check hover states, borders, and text colors

---

### 2. File Upload Flow (Mobile → Server)

**Context:** Handles files from 0 bytes up to guardrail limits (see Audio Transcription). Audio transcription uses server-side chunking for files over 25MB.

#### Architecture Overview

```
User Action → File Selection → Upload Preparation → 
R2 Upload → Backend Notification → Processing → Polling → Display
```

#### Size-Based Strategy

1. **Small Files (< 4MB)**
   - Direct upload via multipart/form-data
   - Fastest for small audio/text files
   - Endpoint: `/api/transcribe`

2. **Large Files (4MB and above, within guardrails)**
   - Pre-signed URL upload to R2
   - Bypasses Vercel's 4.5MB body limit
   - Client uploads directly to R2
   - Backend downloads from R2; for transcription, files over 25MB are chunked server-side (see Audio Transcription)

#### Key Files

**Client-side (Mobile):**
- `packages/mobile/app/(tabs)/index.tsx` - UI and upload initiation
- `packages/mobile/utils/file-handler.ts` - Core upload logic, polling, queue
- `packages/mobile/constants/config.ts` - API URL configuration

**Server-side (Web):**
- `packages/web/app/api/create-upload-url/route.ts` - Generate pre-signed URLs
- `packages/web/app/api/record-upload/route.ts` - Record upload metadata
- `packages/web/app/api/process-file/route.ts` - Trigger processing
- `packages/web/app/api/get-upload-status/[fileId]/route.ts` - Status polling
- `packages/web/app/api/(newai)/transcribe/route.ts` - Audio transcription

#### Detailed Flow

**Phase 1: Initiation** (`index.tsx`)
- User picks file via document picker, photo library, camera, or share intent
- File normalized to `SharedFile` object
- Passed to `uploadFiles()` function

**Phase 2: Preparation** (`file-handler.ts`)
- `uploadFiles()` sets UI status to "uploading"
- Calls `handleFileProcess()` for each file
- `prepareFile()` normalizes filename, mimeType, and fileUri

**Phase 3: Upload**
1. Call `POST /api/create-upload-url` → get presigned URL
2. Upload directly to R2 via `FileSystem.uploadAsync` (PUT request)
3. Call `POST /api/record-upload` → notify backend of upload

**Phase 4: Processing**
- Call `POST /api/process-file` with fileId
- Server enqueues for background OCR/transcription

**Phase 5: Polling**
- `pollForResults()` calls `GET /api/get-upload-status/${fileId}`
- Max 30 attempts, 3-second intervals
- Returns when status is 'completed' or 'error'

**Phase 6: Display**
- Update `uploadResults` state
- Render `ProcessingStatus` component

**Phase 7: Background Sync** (Offline/Retry)
- `saveFileLocally()` stores to `pending_uploads/`
- `addToSyncQueue()` adds to sync queue
- `processSyncQueue()` retries upload when online

#### Benefits of Pre-signed URL Approach
- ✅ No Vercel body size limitations
- ✅ Reuses R2 infrastructure
- ✅ Supports large audio (chunked transcription on server)
- ✅ Better memory usage (streaming)
- ✅ Same pattern as mobile file uploads

---

### 3. Audio Transcription

**Implementation:** Dual-tier upload (direct vs R2); server-side chunking for files over Whisper’s 25MB per-request limit. No user-facing 25MB error; guardrails cap total file size/duration instead.

**Guardrails (transcribe route and upload-audio-to-r2):**
- **MAX_UPLOAD_BYTES** = 250MB – reject with a friendly “too long to process in one request” message (do not mention 25MB).
- **MAX_AUDIO_MINUTES** = 180 – same message if estimated duration exceeds 3 hours.
- Guardrails are checked immediately after the file is in `/tmp`, before any splitting.

**Chunking (files > 25MB, within guardrails):**
- `packages/web/lib/audio/split-audio.ts` – `splitAudioFileBySizeHeuristic()` uses ffprobe for duration and ffmpeg to split by time (each chunk under 24MB). Two-stage: stream copy first; if that fails, re-encode once to MP3 then split.
- Transcribe route runs with `runtime = "nodejs"` (required for FFmpeg, `/tmp`, child_process).
- Whisper is called per chunk with concurrency 1–2; transcripts are merged in chunk index order. Quota is checked and incremented once (full-file duration).

**FFmpeg / FFprobe paths (local vs Vercel):**
- **Local:** Set `FFMPEG_PATH` and `FFPROBE_PATH` in `packages/web/.env.local` (e.g. `/opt/homebrew/bin/ffmpeg`, `/opt/homebrew/bin/ffprobe`) to use your system binaries.
- **Vercel:** Do **not** set `FFMPEG_PATH` or `FFPROBE_PATH` in the project env. The code falls back to the bundled binaries from `ffmpeg-static` and `@ffprobe-installer/ffprobe` (included in the serverless bundle via `outputFileTracingIncludes` in `next.config.js`).

**Plugin-side** (`packages/plugin/index.ts`):
- `transcribeAudio()` – Routes by size: &lt; 4MB direct upload, ≥ 4MB via presigned URL to R2.
- `transcribeAudioViaPresignedUrl()` – Large file handler.

**Server-side:**
- `packages/web/app/api/(newai)/transcribe/route.ts`
  - Direct upload and `handlePresignedUrlTranscription()` – guardrails → quota once → single Whisper or chunked flow → merge → increment usage once.
- Uses OpenAI Whisper API (25MB per request; chunking handles larger files internally).

---

### 4. File Processing Pipeline

**Core workflow in plugin** (the inbox). This is the order `processInboxFile` in `packages/plugin/inbox/index.ts` runs the steps; that function is the source of truth, so check it if this list looks stale:

1. Start (cleanup of leftovers from a previous attempt)
2. Validate the file
3. Move the attachment (audio, image, PDF) to the attachments folder
4. Create the container note
5. Extract (transcribe, OCR, read) into the note
6. Clean up
7. Classify (pick a template)
8. Fetch the YouTube transcript (only for `youtube_*` templates)
9. Format (AI rewrite with the template)
10. Move to the recommended folder
11. Rename
12. Append the attachment to the note
13. Tag (inline tags are appended at the end of the note)
14. Study note (optional, off by default; creates a second note such as flashcards)
15. Complete

**Two-Phase Processing:**

**Phase 1: API Call**
- Get AI recommendations
- Process response

**Phase 2: Application**
- Apply classifications
- Update metadata
- Modify content

**Record Management:**
- Step logging
- Progress tracking
- Error handling
- Performance metrics

#### Changing the inbox pipeline (CRITICAL)

The list above is simplified. The real step order is in `processInboxFile` (`packages/plugin/inbox/index.ts`); read it before changing a step. Later steps read a note that earlier steps have already changed, so a step that assumes the note looks the way it did when the container was created breaks on real files.

Before adding or changing a step:

1. **List what runs before it and what each of those steps appends to the note.** Today that includes the audio embed and transcript (extract), the formatted body (format), the `---` / "Link to original file" backup footer (formatting backup), attachment links (append), and inline `#tags` appended at the very end of the note, after the footer (tagging).
2. **Never assume your marker is the last thing in the note.** Anything you match "at the end" will be followed by whatever later steps append.
3. **Write appended text through the shared functions in `packages/plugin/lib/note-footer.ts`**, so the code that writes and the code that reads cannot drift apart. New appended text goes there too, and into `buildNoteLikeThePipeline` in `packages/plugin/lib/inbox-note-shape.test.ts`.
4. **Build test fixtures from real output** (those functions, or a note pasted from a real run), not hand-written notes. A hand-written fixture repeats the author's assumption and cannot disprove it.
5. **A step after formatting must not fail the file** unless the file is useless without it: catch, warn, carry on (see `createStudyNoteStep`).
6. **Run a real file through the inbox before calling the change done, and say in the PR what you ran.** Passing unit tests do not show the pipeline works: the Flashcards back-link bug passed every unit test and only showed on a real lecture.

---

### 5. AI SDK Integration (Vercel AI SDK)

**Core Components:**

#### 1. Building Blocks
- **Single-Step LLM Generation** - Basic text generation
- **Tool Usage** - Function calling for extended capabilities
- **Multi-Agent Systems** - Multiple LLMs working together

#### 2. Implementation Patterns

**Sequential Processing (Chains):**
```typescript
async function processContent(input: string) {
  const model = openai('gpt-4o');
  
  // Step 1: Generate content
  const { text: content } = await generateText({
    model,
    prompt: `Process this input: ${input}`,
  });

  // Step 2: Quality check
  const { object: quality } = await generateObject({
    model,
    schema: z.object({
      score: z.number().min(1).max(10),
      improvements: z.array(z.string()),
    }),
    prompt: `Evaluate this content: ${content}`,
  });

  return { content, quality };
}
```

**Routing Pattern:**
```typescript
async function handleRequest(input: string) {
  // Classify first
  const { object: classification } = await generateObject({
    model,
    schema: z.object({
      type: z.enum(['general', 'technical', 'support']),
      priority: z.enum(['low', 'medium', 'high']),
    }),
    prompt: `Classify this request: ${input}`,
  });

  // Route based on classification
  const response = await generateText({
    model: classification.priority === 'high' 
      ? openai('gpt-4o')
      : openai('gpt-4o-mini'),
    system: getSystemPrompt(classification.type),
    prompt: input,
  });

  return response;
}
```

#### 3. Tool Integration

**Defining Tools:**
```typescript
const tools = {
  calculate: tool({
    description: 'Evaluate mathematical expressions',
    parameters: z.object({
      expression: z.string(),
    }),
    execute: async ({ expression }) => evaluate(expression),
  }),
  
  fetchData: tool({
    description: 'Retrieve data from database',
    parameters: z.object({
      query: z.string(),
      filters: z.array(z.string()),
    }),
    execute: async ({ query, filters }) => db.fetch(query, filters),
  }),
};
```

**Using Tools with maxSteps:**
```typescript
const { text, steps } = await generateText({
  model: openai('gpt-4o'),
  tools,
  maxSteps: 5,
  prompt: 'Analyze this data and calculate results',
});

// Access all tool calls
const allToolCalls = steps.flatMap(step => step.toolCalls);
```

---

### 6. Chatbot Integration & Local Tool Execution (CRITICAL PATTERN)

**Architecture:** Hybrid approach with **server-defined, client-executed tools**

- **Frontend:** Inside Obsidian plugin (`packages/plugin/views/ai-chat/`)
- **Backend:** Web application APIs
- **Communication:** Streaming via Vercel AI SDK
- **Tool Execution:** **Local** (client-side) with Obsidian API access

---

#### Local Tool Execution Pattern

**Key Concept:** Tools are **defined on the server** (so the AI knows about them) but **executed on the client** (where Obsidian vault access exists).

**Why This Pattern?**
- ✅ **Security:** Vault data never leaves the user's machine
- ✅ **Architecture:** Clean separation - server handles AI, client handles Obsidian
- ✅ **User Control:** User can see and control tool execution
- ✅ **Privacy:** No vault contents sent to server during tool execution

---

#### The Complete Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Server: Tool Definition (tools.ts)                       │
│    - Define tool schema (description, parameters)           │
│    - NO execute function (client-executed)                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Server: AI Model Decision (route.ts)                     │
│    - AI analyzes user message                               │
│    - Decides to call tool (e.g., "getSearchQuery")          │
│    - Streams tool call to client                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Client: Receive Tool Call (chat.tsx)                     │
│    - useChat hook receives toolInvocations                  │
│    - React renders ToolInvocationHandler                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Client: Route to Handler (tool-invocation-handler.tsx)   │
│    - Maps toolName to specific handler component            │
│    - Passes app (Obsidian API) and addToolResult callback   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Client: Execute Tool (e.g., search-handler.tsx)          │
│    - useEffect runs on mount                                │
│    - Executes using Obsidian API (app.vault.read, etc.)     │
│    - Calls addToolResult(result) when complete              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Client: Send Result Back (chat.tsx)                      │
│    - addToolResult sends to server via stream               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Server: AI Continues (route.ts)                          │
│    - Receives tool result                                   │
│    - Generates next response based on result                │
└─────────────────────────────────────────────────────────────┘
```

---

#### Implementation Examples

**1. Server: Tool Definition** (`packages/web/app/api/(newai)/chat/tools.ts`)

```typescript
import { z } from "zod";

export const chatTools = {
  getSearchQuery: {
    description: "Extract semantic search queries to find relevant notes based on content and meaning",
    parameters: z.object({
      query: z.string().describe("The semantic search query to find relevant notes"),
    }),
    // NO execute function - this tool runs on client
  },
  
  appendContentToFile: {
    description: "Add new content to existing notes while preserving structure and formatting",
    parameters: z.object({
      content: z.string().describe("The formatted content to append to the file"),
      message: z.string().describe("Clear explanation of what content will be added"),
      fileName: z.string().optional().describe("Optional specific file to append to"),
    }),
    // NO execute function - this tool runs on client
  },
} as const;
```

**Key Points:**
- ✅ Only `description` and `parameters` defined
- ❌ NO `execute` function on server
- ✅ AI model sees these tools and can decide to call them
- ✅ Zod schemas validate parameters

---

**2. Server: Pass Tools to AI** (`packages/web/app/api/(newai)/chat/route.ts`)

```typescript
import { streamText, createDataStreamResponse } from "ai";
import { chatTools } from "./tools";

export async function POST(req: NextRequest) {
  return createDataStreamResponse({
    execute: async (dataStream) => {
      const { messages, newUnifiedContext } = await req.json();
      
      const result = await streamText({
        model: getModel("gpt-4o-mini"),
        system: getChatSystemPrompt(contextString, currentDatetime),
        maxSteps: 3,  // Allow multi-step tool usage
        messages: messages,
        tools: chatTools,  // Pass tools to AI
        // NO onToolCall - tools execute on client
      });
      
      result.mergeIntoDataStream(dataStream);
    }
  });
}
```

**Key Points:**
- ✅ `tools: chatTools` registers tools with AI
- ✅ `maxSteps: 3` allows multiple tool calls
- ❌ NO `onToolCall` handler (server doesn't execute)
- ✅ AI streams tool calls to client automatically

---

**3. Client: Receive & Route Tool Calls** (`packages/plugin/views/assistant/ai-chat/chat.tsx`)

```typescript
import { useChat } from "@ai-sdk/react";
import ToolInvocationHandler from "./tool-handlers/tool-invocation-handler";

export const ChatComponent = ({ plugin }) => {
  const { messages, addToolResult } = useChat({
    api: `${plugin.getServerUrl()}/api/chat`,
    maxSteps: 2,
    headers: {
      Authorization: `Bearer ${plugin.getApiKey()}`,
    },
  });

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          {/* Render message content */}
          {message.content}
          
          {/* Render tool invocations */}
          {message.toolInvocations?.map((toolInvocation) => (
            <ToolInvocationHandler
              key={toolInvocation.toolCallId}
              toolInvocation={toolInvocation}
              addToolResult={addToolResult}  // Callback to send results back
              app={plugin.app}               // Obsidian API access
            />
          ))}
        </div>
      ))}
    </div>
  );
};
```

**Key Points:**
- ✅ `useChat` hook automatically receives tool calls
- ✅ `message.toolInvocations` contains pending tool calls
- ✅ `addToolResult` callback sends results back to AI
- ✅ `app` provides Obsidian API access

---

**4. Client: Route to Specific Handler** (`packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx`)

```typescript
import { SearchHandler } from "./search-handler";
import { AppendContentHandler } from "./append-content-handler";

function ToolInvocationHandler({ toolInvocation, addToolResult, app }) {
  const handleAddResult = (result: string) =>
    addToolResult({ toolCallId: toolInvocation.toolCallId, result });

  const handlers = {
    getSearchQuery: () => (
      <SearchHandler
        toolInvocation={toolInvocation}
        handleAddResult={handleAddResult}
        app={app}
      />
    ),
    appendContentToFile: () => (
      <AppendContentHandler
        toolInvocation={toolInvocation}
        handleAddResult={handleAddResult}
      />
    ),
    // ... other handlers
  };

  return handlers[toolInvocation.toolName]?.() || null;
}
```

**Key Points:**
- ✅ Maps `toolName` to specific handler component
- ✅ Passes `app` for Obsidian API access
- ✅ Wraps `addToolResult` with `toolCallId`

---

**5. Client: Execute Tool** (`packages/plugin/views/assistant/ai-chat/tool-handlers/search-handler.tsx`)

```typescript
import React, { useRef } from "react";

export function SearchHandler({ toolInvocation, handleAddResult, app }) {
  const hasFetchedRef = useRef(false);

  const searchNotes = async (query: string) => {
    const files = app.vault.getMarkdownFiles();  // Obsidian API
    const searchTerms = query.toLowerCase().split(/\s+/);

    const searchResults = await Promise.all(
      files.map(async (file) => {
        const content = await app.vault.read(file);  // Obsidian API
        const lowerContent = content.toLowerCase();

        const allTermsPresent = searchTerms.every((term) =>
          new RegExp(`(^|\\W)${term}(\\W|$)`, "i").test(lowerContent)
        );

        if (allTermsPresent) {
          return {
            title: file.basename,
            content: content,
            path: file.path,
          };
        }
        return null;
      })
    );

    return searchResults.filter((result) => result !== null);
  };

  React.useEffect(() => {
    const handleSearchNotes = async () => {
      // Only execute once, and only if no result yet
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { query } = toolInvocation.args;  // Get AI's arguments
        
        try {
          // Execute using Obsidian API
          const searchResults = await searchNotes(query);
          
          // Send result back to AI
          handleAddResult(JSON.stringify(searchResults));
        } catch (error) {
          handleAddResult(JSON.stringify({ error: error.message }));
        }
      }
    };

    handleSearchNotes();
  }, [toolInvocation, handleAddResult, app]);

  return (
    <div className="text-sm text-[--text-muted]">
      {!("result" in toolInvocation)
        ? "Searching through your notes..."
        : "Search complete"}
    </div>
  );
}
```

**Key Points:**
- ✅ `useEffect` triggers execution on mount
- ✅ `hasFetchedRef` prevents duplicate execution
- ✅ Checks `!("result" in toolInvocation)` to avoid re-execution
- ✅ Accesses `toolInvocation.args` for AI's parameters
- ✅ Uses `app.vault` Obsidian API to access files
- ✅ Calls `handleAddResult(JSON.stringify(result))` to send back
- ✅ UI shows progress/completion state

---

#### Current Available Tools

**Search & Discovery:**
- `getSearchQuery` - Semantic search through vault
- `searchByName` - Search by file name pattern
- `getLastModifiedFiles` - Get recently modified files

**Content Manipulation:**
- `appendContentToFile` - Add content to existing files
- `addTextToDocument` - Add sections to documents
- `modifyDocumentText` - Edit document content

**File Organization:**
- `moveFiles` - Organize files into folders
- `renameFiles` - Rename files intelligently
- `executeActionsOnFileBasedOnPrompt` - Complex file operations

**Vault Management:**
- `analyzeVaultStructure` - Analyze vault organization
- `generateSettings` - Create organization settings

**Media:**
- `getYoutubeVideoId` - Import YouTube transcripts

---

#### Adding New Local Tools

**Step 1:** Define on server (`tools.ts`)
```typescript
export const chatTools = {
  // ... existing tools
  
  myNewTool: {
    description: "What this tool does",
    parameters: z.object({
      param1: z.string().describe("Description"),
      param2: z.number().optional().describe("Description"),
    }),
  },
};
```

**Step 2:** Add handler mapping (`tool-invocation-handler.tsx`)
```typescript
const handlers = {
  // ... existing handlers
  
  myNewTool: () => (
    <MyNewToolHandler
      toolInvocation={toolInvocation}
      handleAddResult={handleAddResult}
      app={app}
    />
  ),
};
```

**Step 3:** Create handler component (`my-new-tool-handler.tsx`)
```typescript
export function MyNewToolHandler({ toolInvocation, handleAddResult, app }) {
  const hasFetchedRef = useRef(false);

  React.useEffect(() => {
    const execute = async () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { param1, param2 } = toolInvocation.args;
        
        try {
          // Execute using Obsidian API
          const result = await doSomething(app, param1, param2);
          handleAddResult(JSON.stringify(result));
        } catch (error) {
          handleAddResult(JSON.stringify({ error: error.message }));
        }
      }
    };
    execute();
  }, [toolInvocation, handleAddResult, app]);

  return <div>Executing...</div>;
}
```

**Step 4:** Add title to `getToolTitle()` (`tool-invocation-handler.tsx`)
```typescript
const toolTitles = {
  // ... existing titles
  myNewTool: "My New Tool",
};
```

---

#### Important Patterns

**1. Prevent Double Execution**
```typescript
const hasFetchedRef = useRef(false);
if (!hasFetchedRef.current && !("result" in toolInvocation)) {
  hasFetchedRef.current = true;
  // execute only once
}
```

**2. Access Tool Arguments**
```typescript
const { arg1, arg2 } = toolInvocation.args;
```

**3. Send Results Back**
```typescript
// Success
handleAddResult(JSON.stringify(result));

// Error
handleAddResult(JSON.stringify({ error: error.message }));
```

**4. Show UI Progress**
```typescript
return (
  <div>
    {!("result" in toolInvocation)
      ? "Processing..."
      : "Complete"}
  </div>
);
```

**5. Access Obsidian API**
```typescript
// Read files
const files = app.vault.getMarkdownFiles();
const content = await app.vault.read(file);

// Write files
await app.vault.create(path, content);
await app.vault.modify(file, newContent);

// Move/rename
await app.fileManager.renameFile(file, newPath);
```

---

#### Testing Local Tools

1. Start dev server: `cd packages/web && pnpm dev`
2. Start plugin dev: `cd packages/plugin && pnpm dev`
3. Open Obsidian with plugin installed
4. Open AI chat panel
5. Trigger tool: "Search for notes about X"
6. Observe:
   - Server logs show AI decision
   - Client UI shows tool executing
   - Result sent back and AI continues

---

#### Debugging Local Tools

**Server Side:**
```typescript
console.log("Tool definitions:", chatTools);
console.log("AI decided to call:", toolCall.toolName);
```

**Client Side:**
```typescript
console.log("Tool invocation:", toolInvocation);
console.log("Tool args:", toolInvocation.args);
console.log("Tool result:", result);
```

**Common Issues:**
- ❌ Tool not defined on server → AI can't see it
- ❌ Handler not mapped → Tool call ignored
- ❌ No `hasFetchedRef` → Executes multiple times
- ❌ Forgot `JSON.stringify()` → Invalid result format
- ❌ No error handling → Silent failures

---

## Development Best Practices

### 1. Code Organization

**Plugin (`packages/plugin/`):**
- Use TypeScript
- Follow Obsidian plugin architecture
- Implement proper error handling
- Test file operations thoroughly

**Web (`packages/web/`):**
- Use Next.js App Router conventions
- Implement React Server Components
- Follow REST API patterns
- Secure all endpoints

**Mobile (`packages/mobile/`):**
- Use Expo/React Native patterns
- Handle offline scenarios
- Implement background sync
- Test on both iOS and Android

### 2. Security

- Protect API keys in environment variables
- Validate user input on all endpoints
- Implement proper authentication (Clerk)
- Use rate limiting
- Secure tool execution
- Handle file permissions properly

### 3. Performance

**AI Integration:**
- Use appropriate model sizes
- Implement caching strategies
- Optimize prompt length
- Monitor token usage
- Track usage in database

**File Operations:**
- Batch operations when possible
- Stream large files
- Clean up temporary files
- Implement proper queuing

**Mobile:**
- Offline-first approach
- Efficient sync strategies
- Battery optimization
- Data usage optimization

### 4. Error Handling

**Pipeline Errors:**
- Step failure recovery
- Partial completion support
- Rollback capabilities
- Comprehensive error logging

**AI Service Errors:**
- Timeout handling
- Rate limit management
- Fallback options
- Graceful degradation

**File System Errors:**
- Access issues
- Space constraints
- Permission problems
- Sync conflict resolution

### 5. Testing

- Write unit tests for utilities
- Integration tests for API endpoints
- Test error scenarios
- Validate AI responses
- Test cross-platform (mobile)

---

## Environment Setup

### Required Environment Variables

**Web Package:**
```env
# Database
DATABASE_URL=

# Authentication (Clerk)
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

# AI Services
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
MODEL_NAME=claude-3-opus-20240229

# Payments (Stripe)
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Storage (R2/S3)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

**Mobile Package:**
```env
API_URL=https://your-backend.com
```

---

## Development Workflow

### 1. Getting Started
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run specific package
cd packages/web
pnpm dev

cd packages/plugin
pnpm dev

cd packages/mobile
pnpm start
```

### 2. Making Changes

1. **Understand the context** - Read relevant cursor rules
2. **Check styling requirements** - Use StyledContainer for plugin UI
3. **Follow patterns** - Match existing code style
4. **Test locally** - Verify changes work
5. **Document changes** - Update relevant docs

### 3. Working with Specific Areas

**If working on uploads:**
- Read `file-upload-flow.mdc`
- Understand presigned URL flow
- Test with various file sizes
- Handle offline scenarios

**If working on AI features:**
- Read `ai-sdk-integration.mdc`
- Use Vercel AI SDK patterns
- Track token usage
- Implement proper error handling

**If working on chatbot:**
- Read `chatbot-integration.mdc`
- Use streaming responses
- Integrate Obsidian tools
- Handle context properly

**If working on plugin:**
- Read `plugin-development.mdc`
- Follow Obsidian guidelines
- Use StyledContainer for UI
- Test with real vault

**If working on web:**
- Read `web-development.mdc`
- Follow Next.js conventions
- Secure all endpoints
- Test authentication flow

**If working on mobile:**
- Read `mobile.mdc` and `file-upload-flow.mdc`
- Test on both platforms
- Handle offline mode
- Implement background sync

### 4. Common Patterns

**Structured Output (AI):**
```typescript
const { object } = await generateObject({
  model,
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    keywords: z.array(z.string()),
  }),
  prompt: 'Analyze this content',
});
```

**Streaming Responses:**
```typescript
const stream = await streamText({
  model,
  prompt: 'Generate a long response',
  onToken: (token) => {
    // Handle each token
  },
});
```

**Tool Orchestration:**
```typescript
const agent = {
  tools,
  maxSteps: 5,
  onToolCall: async ({ toolCall }) => {
    return await executeTool(toolCall);
  },
};
```

---

## Troubleshooting Guide

### Style Issues (Plugin)
- Missing `StyledContainer` wrapper
- Not using `tw()` function
- Hardcoded CSS classes
- Obsidian CSS conflicts

### Upload Issues (Mobile)
- File exceeds guardrails (250MB or 180 min) – user sees “too long to process in one request”
- Network connectivity
- Invalid presigned URL
- R2 upload failure
- Backend processing timeout

### AI Issues
- Token limits exceeded
- Rate limiting
- Invalid schema
- Model timeout
- Context too large

### Database Issues
- Connection failures
- Migration errors
- Query timeouts
- Constraint violations

---

## Key Files Reference

### Plugin
- `packages/plugin/index.ts` - Main plugin file
- `packages/plugin/views/ai-chat/` - Chat interface
- `packages/plugin/components/ui/` - UI components
- `packages/plugin/handlers/` - Event handlers

### Web
- `packages/web/app/api/(newai)/` - AI endpoints
- `packages/web/app/api/create-upload-url/route.ts` - Presigned URLs
- `packages/web/app/api/record-upload/route.ts` - Upload metadata
- `packages/web/app/api/process-file/route.ts` - Processing trigger
- `packages/web/drizzle/schema.ts` - Database schema
- `packages/web/middleware.ts` - Request middleware

### Mobile
- `packages/mobile/app/(tabs)/index.tsx` - Main UI
- `packages/mobile/utils/file-handler.ts` - Upload logic
- `packages/mobile/components/processing-status.tsx` - Status UI

---

## Important Reminders

1. **Always** wrap plugin UI components in `StyledContainer`
2. **Always** use `tw()` for className in plugin
3. **Always** handle file sizes properly in upload flow
4. **Always** implement proper error handling
5. **Always** track token usage for AI calls
6. **Always** test on both platforms (mobile)
7. **Always** validate user input
8. **Always** clean up temporary files
9. **Always** document API changes
10. **Never** commit API keys or secrets

---

## Additional Resources

- Obsidian Plugin API: https://docs.obsidian.md/
- Vercel AI SDK: https://sdk.vercel.ai/docs
- Next.js Documentation: https://nextjs.org/docs
- Expo Documentation: https://docs.expo.dev/
- Drizzle ORM: https://orm.drizzle.team/

---

## Questions to Ask Before Making Changes

1. Does this affect plugin UI? → Use StyledContainer
2. Does this handle file uploads? → Check size limits and flow
3. Does this use AI? → Track tokens and handle errors
4. Does this work offline? → Implement background sync
5. Does this need authentication? → Use Clerk
6. Does this affect mobile? → Test on iOS and Android
7. Does this change the API? → Update documentation
8. Does this touch the database? → Use migrations
9. **Does this change backend API contracts?** → Implement backward compatibility (see below)

---

## API Backward Compatibility (CRITICAL)

**Problem:** We cannot control when users update the plugin. Breaking API changes will break the plugin for users who haven't updated yet.

**Solution:** When making backend API changes, implement progressive enhancement that supports both old and new plugin versions.

**Pattern:**
- Accept both old and new parameter formats
- Provide sensible defaults for missing fields
- Gracefully handle deprecated fields
- Only remove deprecated fields after sufficient migration period (3+ months)

**Example:**
```typescript
// BAD: Breaking change
export async function POST(req: NextRequest) {
  const { newRequiredField } = await req.json();  // ❌ Old plugins will break
  // ...
}

// GOOD: Backward compatible
export async function POST(req: NextRequest) {
  const { newRequiredField, oldField } = await req.json();
  const value = newRequiredField || oldField || 'sensible-default';  // ✅ Works with old & new
  // ...
}
```

**When to suggest this:**
- User asks for changes to API endpoints (`packages/web/app/api/`)
- Changes to request/response formats
- Adding required fields to API requests
- Removing fields from API responses

---

**Last Updated:** 2025-01-22

**Maintained by:** Note Companion Development Team

**For bugs and issues:** See tutorials/bugs.md
