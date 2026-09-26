# Dual-protocol chat (AI SDK 4 + 5) — 2026-09-20

Issue #483. Option A is locked.

## Pins (measured)

- Catalog `ai` stays `^4.1.54`. Web and release-notes nest `ai@4.1.54`.
- Web adds `"ai-v5": "npm:ai@5.0.261"` for `POST /api/chat/v5`.
- Plugin chat is on `"ai": "5.0.261"` and `"@ai-sdk/react": "2.0.264"`. Local classify/tags/folders still import `generateObject` from `"ai-v4": "npm:ai@4.1.54"` with `ollama-ai-provider@0.15.2`.
- Plugin Ollama chat uses `ollama-ai-provider-v2@1.0.0` + `toUIMessageStreamResponse`.
- `ai@5.0.261` does **not** export `createDataStreamResponse`. A single `ai@5` cannot serve the v4 data-stream route.
- `/api/chat/v5` uses `"@ai-sdk/openai-v5": "npm:@ai-sdk/openai@2.0.127"` (LanguageModelV2). Catalog `@ai-sdk/openai@1` stays on `/api/chat`. Do not pass `getModel()` into `ai-v5` `streamText` — V1 throws `AI_UnsupportedModelVersionError`.

## How callers pick a protocol

- Old plugins: `POST /api/chat` → `createDataStreamResponse` from catalog `ai@4`.
- New plugin: `POST /api/chat/v5` via `DefaultChatTransport` → UIMessage stream from `ai-v5` on the server.
- Shared business rules live in `packages/web/lib/chat/prepare-chat-request.ts`. Tools stay server-defined with **no** `execute`. Client handlers still receive a local `{ args, result }` shape.

## Chat history

Vault file `_NoteCompanion/.chat-history.json` may still be v4 `Message[]`. `convertLegacyToUIMessage` (plugin) and `coerceToUiMessages` (server) rewrite `content` / `toolInvocations` / `experimental_attachments` **and** existing `tool-invocation` parts into `tool-${name}`. Do not early-return raw v4 parts.

## When to delete `/api/chat` (v4)

Calendar time is not enough. Obsidian plugin updates are **manual**, so leftover traffic can last past 3 months.

Gate (all of these):

1. The v5 plugin has shipped (clients actually call `/api/chat/v5`).
2. At least **3 months** after that ship.
3. PostHog `call-api` with `endpoint=chat` is **~0 for 2–4 weeks** while `endpoint=chat/v5` is still live.

How to check: `packages/web/lib/handleAuthorization.ts` captures `call-api` with `endpoint: req.nextUrl.pathname.replace('/api/', '')`. So v4 = `chat`, v5 = `chat/v5`. Query those two values; do not use the BirdSift PostHog project.

Then delete `/api/chat`, the v4 data-stream path, and (later) the history converter.

## Next slice

Sit on v5. Do not jump to v6 until the gate above is met. Phase 1 (non-chat catalog bump: tags/folders/vision `generateObject`) is still later.

## Unverified

- Live Ollama chat through `ollama-ai-provider-v2` + plugin `useChat` transport. `ollama-ai-provider-v2` peers `zod@^4`; the repo override keeps zod 3.25.
- End-to-end plugin chat in Obsidian (cloud tools + web search).
- Non-OpenAI `MODEL_PROVIDER` on `/api/chat/v5` (v5 models are OpenAI v2 / OpenAI-compatible only).
