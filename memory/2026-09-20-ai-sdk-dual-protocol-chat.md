# Dual-protocol chat (AI SDK 4 + 5) — 2026-09-20

Issue #483. Option A is locked.

## Pins (measured)

- Catalog `ai` stays `^4.1.54`. Web and release-notes nest `ai@4.1.54`.
- Web adds `"ai-v5": "npm:ai@5.0.261"` for `POST /api/chat/v5`.
- Plugin chat is on `"ai": "5.0.261"` and `"@ai-sdk/react": "2.0.264"`. Local classify/tags/folders still import `generateObject` from `"ai-v4": "npm:ai@4.1.54"` with `ollama-ai-provider@0.15.2`.
- Plugin Ollama chat uses `ollama-ai-provider-v2@1.0.0` + `toUIMessageStreamResponse`.
- `ai@5.0.261` does **not** export `createDataStreamResponse`. A single `ai@5` cannot serve the v4 data-stream route.

## How callers pick a protocol

- Old plugins: `POST /api/chat` → `createDataStreamResponse` from catalog `ai@4`.
- New plugin: `POST /api/chat/v5` via `DefaultChatTransport` → UIMessage stream from `ai-v5` on the server.
- Shared business rules live in `packages/web/lib/chat/prepare-chat-request.ts`. Tools stay server-defined with **no** `execute`. Client handlers still receive a local `{ args, result }` shape.

## Chat history

Vault file `_NoteCompanion/.chat-history.json` may still be v4 `Message[]`. `convertLegacyToUIMessage` runs on load (`content` / `toolInvocations` / `experimental_attachments` → `parts`).

## Next slice

Sit on v5. Do not jump to v6 until `/api/chat` v4 can be deleted (~3+ months). Phase 1 (non-chat catalog bump: tags/folders/vision `generateObject`) is still later.

## Unverified

- Live `streamText` from `ai@5.0.261` against `@ai-sdk/openai@1` (LanguageModelV1) on the server. Tests mock `ai-v5`.
- Live Ollama chat through `ollama-ai-provider-v2` + plugin `useChat` transport. `ollama-ai-provider-v2` peers `zod@^4`; the repo override keeps zod 3.25.
- End-to-end plugin chat in Obsidian (cloud tools + web search).
