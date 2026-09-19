# AI SDK 4 → 5 → 6 upgrade plan (2026-09-18)

## Context

Issue [#483](https://github.com/Nexus-JPF/note-companion/issues/483) (unsolicited Emendant scan of `5203f21`): plugin chat still on **ai 4.1.54**, and three assistant files would break on v5/v6.

The three cited imports are real. The scan understates the work. The real project is the **chat stream protocol** plus every `@ai-sdk/*` provider — not a three-file rename.

**Current pins (still true after `5203f21`):**

- Catalog: `ai: ^4.1.54`, `@ai-sdk/*` v1
- Plugin (not on catalog for these): `"ai": "^4.1.54"`, `"@ai-sdk/react": "^1.0.6"`
- `ollama-ai-provider: ^0.15.2` (v4-era; local chat in `chat.tsx` depends on it)

Official guides:

- [Migrate AI SDK 4.x to 5.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0)
- [Migrate AI SDK 5.x to 6.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)

## Recommendation

**Do 4 → 5 first, then 5 → 6. Do not jump to v6.**

v5 still has `convertToCoreMessages` as a deprecated alias. **v6 deletes it.** Sit on v5 until the v4 chat path is unused, then do v6 as a small follow-up.

Stay on 4.1.54 until you want a v5/v6 feature. Chat works today.

## Constraint that shapes the whole plan

Old plugins in the wild still call `/api/chat` with the **v4 data-stream protocol** (`useChat` + `createDataStreamResponse`). AI SDK 5 clients speak **UIMessage streams**. Those are not interchangeable.

Project rule (`AGENTS.md`): backend API changes must keep old plugins working for **3+ months**. You cannot bump `ai` and rewrite `/api/chat` in place.

Decide this before any code:

| Option | What it means |
|---|---|
| **A. Dual protocol (recommended)** | New plugin talks to a v5 chat path. Keep a v4 `/api/chat` for old plugins ~3 months. If `ai@5` dropped `createDataStreamResponse`, alias `ai@4` for that route only (`npm:ai@4.1.54`). |
| **B. Coordinated cutover** | Ship plugin + web on the same day; chat breaks for anyone who has not updated. Violates the compatibility rule. |
| **C. Stay on 4.x** | Correct if there is no v5/v6 feature you need. |

## What not to change

Keep **server-defined, client-executed tools**:

- Schemas in `packages/web/app/api/(newai)/chat/tools.ts` with **no** `execute`
- Handlers in `packages/plugin/views/assistant/ai-chat/tool-handlers/`
- Vault data stays on the user’s machine

Inbox, vision, tags, folders, title, modify, process-file stay request/response JSON. Those can move to SDK 5 without a new plugin **if** the JSON contracts do not change.

## Issue #483 accuracy

| File | Claim | Status |
|---|---|---|
| `packages/plugin/views/assistant/ai-chat/chat.tsx:29` | `convertToCoreMessages` + `Message` | Accurate. Also used at line 558 (Ollama). v5: `Message` → `UIMessage` (hard break). `convertToCoreMessages` → `convertToModelMessages`; old name gone in v6. |
| `packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx` | `ToolInvocation` + `Attachment` → message parts | Accurate for `ToolInvocation`. **`Attachment` is not imported from `ai` on that line.** Chat attachments are local `LocalAttachment`. The SDK break is `message.experimental_attachments` in `message-renderer.tsx`. |
| `packages/plugin/views/assistant/ai-chat/export-chat-as-markdown.ts` | `Message` import | Accurate. |

Missed on the plugin side: `types/chat-api.ts`, `message-renderer.tsx`, `chat-history-manager.ts`, `url-fetch-handler.tsx`, and the `useChat` rewrite itself.

Missed entirely: `packages/web/app/api/(newai)/chat/route.ts` (`convertToCoreMessages` × 4, `createDataStreamResponse`, `mergeIntoDataStream`, `maxSteps`).

## Phase 0 — inventory and pinning

- Treat catalog `ai` and the plugin’s own `ai` / `@ai-sdk/react` as one lockstep set (plugin is not on catalog today).
- Providers: `@ai-sdk/{openai,anthropic,google,groq,mistral,deepseek,amazon-bedrock}` **v1 → v2 with SDK 5**, **v3 with SDK 6**.
- Confirm whether `ai@5` still exports `createDataStreamResponse`. That decides option A’s alias vs a hand-rolled v4 adapter.
- Avoid two copies of `ai` in the pnpm workspace unless Phase 2 is delayed.

## Phase 1 — non-chat server APIs on SDK 5 (lower risk)

Mechanical upgrades. Keep HTTP bodies identical.

- `packages/web/lib/models.ts` (`LanguageModel`)
- `packages/web/app/api/(newai)/aiService.ts`
- tags / folders / title / modify / vision / concepts-and-chunks
- `process-file`, `process-pending-uploads`
- `format-stream`, `enhance-meeting-note`
- `packages/release-notes`

Typical v5 edits:

- `generateObject` `schema` → new output API
- `maxTokens` → `maxOutputTokens`
- `onFinish` usage shape (token accounting lives here)

Ship with Phase 2/3 if you want a single `ai` version in the repo.

## Phase 2 — chat server on SDK 5 (new path)

Target: `packages/web/app/api/(newai)/chat/route.ts` and `route.test.ts`.

| v4 | v5 |
|---|---|
| `createDataStreamResponse` + `mergeIntoDataStream` | `createUIMessageStream` / `toUIMessageStreamResponse` |
| `convertToCoreMessages` | `convertToModelMessages` |
| `maxSteps` | `stopWhen: stepCountIs(n)` (`lib/chat/chat-max-steps.ts` stays the policy) |
| `tool.parameters` | `tool({ inputSchema })` — still no `execute` |
| `message.toolInvocations` filtering | `parts` with `tool-${name}`, `input` / `output` |
| `onFinish` usage | `messageMetadata` on the UI stream |

Rewrite `applyYoutubeToolDedupToCoreMessages` for model messages.

**Compat:** leave current `/api/chat` as the v4 stream. Add `/api/chat/v5` (or a header). Matches existing `tags/v2`, `folders/v2` style.

## Phase 3 — plugin chat UI (bulk of the work)

`chat.tsx` is ~2000 lines of v4 `useChat`. This is the project, not the three imports.

### `useChat` rewrite (`chat.tsx`)

- Own input state (`input` / `handleInputChange` / `handleSubmit` go away)
- `append` → `sendMessage`
- `addToolResult` → `addToolOutput` (`result` → `output`)
- Drop `maxSteps` on the hook; server uses `stopWhen`
- `experimental_prepareRequestBody` → transport / `DefaultChatTransport`
- Ollama path: `toDataStreamResponse` → `toUIMessageStreamResponse`; `convertToCoreMessages` → `convertToModelMessages`
- Point the new plugin at the v5 chat path; old builds keep hitting `/api/chat`

### Types and handlers

- `tool-invocation-handler.tsx`, `url-fetch-handler.tsx`, `types/chat-api.ts` — `ToolInvocation` / `toolInvocations` → parts (`tool-${name}`, `args` → `input`, `result` → `output`)
- `message-renderer.tsx` — `Message` → `UIMessage`; `experimental_attachments` → file parts
- `export-chat-as-markdown.ts`, `chat-history-manager.ts` — `Message` → `UIMessage`

### Chat history

Vault file `_NoteCompanion/.chat-history.json` is v4 `Message[]`. On load, convert once to `UIMessage` (`content` / `toolInvocations` → `parts`). Keep a reader for old files.

### Preserve

- Local tool handlers + `hasFetchedRef` (no double execution)
- Cloud vs Ollama branch
- Web-search grounding
- Context items and editor selection
- Export-to-vault

## Phase 4 — sit on v5, then v6

Only after the v4 chat path is unused:

- `await convertToModelMessages(...)` (async in v6)
- `CoreMessage` fully gone
- `isToolUIPart` helper renames
- Providers v2 → v3
- Test mocks `LanguageModelV2` → `V3`

If Phase 3 already uses `UIMessage`, parts, and `convertToModelMessages`, v6 is days, not weeks.

Then delete `/api/chat` v4, the `ai@4` alias, and the history converter.

## Test plan (must pass before a plugin release)

1. **Old plugin + new web** — cloud chat, tools, web search still work on `/api/chat`.
2. **New plugin + new web** — same flows on the v5 path, including multi-step client tools.
3. **Ollama** — local `streamText` path; tools still client-side.
4. **Reload** a vault that has `_NoteCompanion/.chat-history.json` from today.
5. **Non-chat** — inbox classify, tags, folders, title, vision, token increment.
6. **Release order** — deploy web (v4 + v5 endpoints) **before** shipping the plugin that requires v5.

## Effort

- Phase 1: a couple of days
- Phase 2–3: the project (chat.tsx + chat route + ~20 tool handlers + history)
- Phase 4: short, once Phase 3 is done

## Do not

- Implement #483 as a three-file rename
- Jump 4 → 6 in one PR
- Add `execute` on server chat tools
- Take the Emendant “free 20-minute check” as a migration plan
- Split `ai@4` (plugin) and `ai@5` (web) in the workspace unless Phase 2 is delayed

## First decision

**A vs B vs C.** Everything else hangs off that.

## How to apply

No code yet. When starting:

1. Lock option A/B/C
2. Verify `createDataStreamResponse` availability on `ai@5`
3. Phase 1 (non-chat) only if catalog bump is in the same effort as chat, or if a temporary dual-`ai` pin is accepted
4. Phase 2 server path + Phase 3 plugin together
5. Hold v6 until v4 `/api/chat` can be deleted
