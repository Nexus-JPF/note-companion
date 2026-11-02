#!/usr/bin/env node
/**
 * Live smoke test for the AI routes the plugin depends on.
 *
 * Sends one tiny real request per route (using the deployment's real
 * MODEL_NAME / provider keys) and checks for a 200 and a well-formed body.
 * Streaming routes are read to the end. This catches provider/model
 * incompatibilities that unit tests cannot (e.g. OpenAI rejecting
 * reasoning_effort together with function tools for some models).
 *
 * Env:
 *   SMOKE_API_KEY   Note Companion API key for a dedicated test user (required)
 *   SMOKE_BASE_URL  Deployment to test (default https://app.notecompanion.ai)
 *   SMOKE_ONLY      Comma-separated route names to run (default: all)
 *
 * Usage: node packages/web/scripts/smoke-ai-routes.mjs
 */

const BASE_URL = (
  process.env.SMOKE_BASE_URL || "https://app.notecompanion.ai"
).replace(/\/$/, "");
const API_KEY = process.env.SMOKE_API_KEY;
const ONLY = (process.env.SMOKE_ONLY || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const TIMEOUT_MS = 90_000;

// The API key is sent to BASE_URL, so only allow our own hosts.
const ALLOWED_HOST = /^(app\.notecompanion\.ai|localhost|127\.0\.0\.1|[a-z0-9-]+-nexus-jpf-inc\.vercel\.app)$/;

export function assertAllowedBaseUrl(url) {
  const parsed = new URL(url);
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (!ALLOWED_HOST.test(parsed.hostname) || (!local && parsed.protocol !== "https:")) {
    throw new Error(`Refusing to send the API key to ${parsed.origin}`);
  }
}

const NOTE = `# Weekly sync
Attendees: Sam, Priya. We agreed to ship the new onboarding flow on Friday.
Action items: Sam updates the docs, Priya reviews the pricing page.`;

const isString = (v) => typeof v === "string";
const isNonEmptyArray = (v) => Array.isArray(v) && v.length > 0;

/** Each check: name, path, request body, and a validator for the response. */
export const checks = [
  {
    name: "classify1",
    path: "/api/classify1",
    body: { content: NOTE, templateNames: ["Meeting Note", "Recipe"] },
    json: (j) => isString(j.documentType) || "missing string documentType",
  },
  {
    name: "tags/v2",
    path: "/api/tags/v2",
    body: { content: NOTE, fileName: "Weekly sync", existingTags: [], count: 3 },
    json: (j) => Array.isArray(j.tags) || "missing tags array",
  },
  {
    name: "folders/v2",
    path: "/api/folders/v2",
    body: {
      content: NOTE,
      fileName: "Weekly sync",
      folders: ["Meetings", "Recipes", "Projects"],
      count: 3,
    },
    json: (j) => Array.isArray(j.folders) || "missing folders array",
  },
  {
    name: "title/v2",
    path: "/api/title/v2",
    body: { content: NOTE, fileName: "Untitled", count: 3 },
    json: (j) => Array.isArray(j.titles) || "missing titles array",
  },
  {
    name: "concepts-and-chunks",
    path: "/api/concepts-and-chunks",
    body: { content: NOTE },
    json: (j) => isNonEmptyArray(j.concepts) || "missing concepts",
  },
  {
    name: "format",
    path: "/api/format",
    body: { content: NOTE, formattingInstruction: "Use bullet points." },
    json: (j) => isString(j.content) || "missing formatted content",
  },
  {
    name: "format-stream",
    path: "/api/format-stream",
    body: { content: NOTE, formattingInstruction: "Use bullet points." },
    stream: (text) => text.trim().length > 0 || "empty stream",
  },
  {
    name: "modify",
    path: "/api/modify",
    body: {
      content: NOTE,
      originalContent: NOTE,
      instructions: "Fix the title to 'Weekly Sync'.",
    },
    json: (j) => isString(j.content) || "missing content",
  },
  {
    name: "enhance-meeting-note",
    path: "/api/enhance-meeting-note",
    body: {
      transcript: "Sam: Let's ship onboarding Friday. Priya: I'll review pricing.",
      currentNoteContent: "",
      fileName: "Weekly sync",
      recordingDate: "2026-01-01",
      recordingDuration: "00:01:00",
      recordingFileName: "sync.m4a",
      recordingFilePath: "sync.m4a",
    },
    stream: (text) => text.trim().length > 0 || "empty stream",
  },
  {
    // Sends the chat tool definitions to the model, which is the combination
    // (tools + reasoning settings) that has broken before. Web search is on by
    // default, so this covers the search path; the next check covers no-search.
    name: "chat/v5",
    path: "/api/chat/v5",
    body: {
      messages: [
        {
          id: "smoke-1",
          role: "user",
          parts: [{ type: "text", text: "Reply with the single word: pong" }],
        },
      ],
      currentDatetime: new Date().toISOString(),
    },
    stream: (text) => {
      if (/"type"\s*:\s*"error"/.test(text)) return "error chunk in stream";
      return /text-delta/.test(text) || "no text-delta in stream";
    },
  },
];

// Tiny AAC-in-M4A clip (macOS afconvert, the same container iPhone Voice Memos
// produce). The route re-encodes m4a/mp4 with the bundled ffmpeg before
// Whisper, so this fails with a 400 when ffmpeg is missing from the deployment.
const M4A_BASE64 =
  "AAAAHGZ0eXBNNEEgAAAAAE00QSBtcDQyaXNvbQAAA15tb292AAAAbG12aGQAAAAA5w2HRucNh0YAAC7gAAAcAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAB8HRyYWsAAABcdGtoZAAAAAfnDYdG5w2HRgAAAAEAAAAAAAAcAAAAAAAAAAAAAAAAAAEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAYxtZGlhAAAAIG1kaGQAAAAA5w2HRucNh0YAAC7gAAAcAAAAAAAAAAAiaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAAAAAAABQm1pbmYAAAAQc21oZAAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAABBnN0YmwAAAB2c3RzZAAAAAAAAAABAAAAZm1wNGEAAAAAAAAAAQAAAAAAAAAAAAIAEAAAAAAu4AAAAAAAM2VzZHMAAAAAA4CAgCIAAAAEgICAFEAUABgAAAAHQAAAPoAFgICAAhSIBoCAgAECAAAAD3NidGQAAAAASTE2AAAAGHN0dHMAAAAAAAAAAQAAAAcAAAQAAAAAKHN0c2MAAAAAAAAAAgAAAAEAAAAGAAAAAQAAAAIAAAABAAAAAQAAADBzdHN6AAAAAAAAAAAAAAAHAAAABAAAAOQAAAEeAAAArgAAAJwAAACjAAAAgQAAABhzdGNvAAAAAAAAAAIAABAAAAAT8wAAAPp1ZHRhAAAA8m1ldGEAAAAAAAAAImhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAAAMRpbHN0AAAAvC0tLS0AAAAcbWVhbgAAAABjb20uYXBwbGUuaVR1bmVzAAAAFG5hbWUAAAAAaVR1blNNUEIAAACEZGF0YQAAAAEAAAAAIDAwMDAwMDAwIDAwMDAwODQwIDAwMDAwMTgyIDAwMDAwMDAwMDAwMDEyM0UgMDAwMDAwMDAgMDAwMDAwMDAgMDAwMDAwMDAgMDAwMDAwMDAgMDAwMDAwMDAgMDAwMDAwMDAgMDAwMDAwMDAgMDAwMDAwMDAAAAx+ZnJlZQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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";

checks.push({
  name: "transcribe (m4a)",
  path: "/api/transcribe",
  form: () => {
    const form = new FormData();
    form.append(
      "audio",
      new Blob([Buffer.from(M4A_BASE64, "base64")], { type: "audio/x-m4a" }),
      "smoke.m4a"
    );
    return form;
  },
  json: (j) => isString(j.text) || "missing transcript text",
});

const chatCheck = checks.find((c) => c.name === "chat/v5");
checks.push({
  ...chatCheck,
  name: "chat/v5 (no search)",
  body: { ...chatCheck.body, enableChatWebSearch: false },
});

/** Decide pass/fail for a response. Pure, so it can be unit tested. */
export function evaluate(check, status, raw) {
  if (!(status >= 200 && status < 300)) {
    return `HTTP ${status}: ${raw.slice(0, 300)}`;
  }
  let verdict;
  if (check.json) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return `non-JSON body: ${raw.slice(0, 200)}`;
    }
    // A 200 carrying an error body is a failure (some routes used to do this).
    if (parsed && parsed.error) return `200 with error: ${parsed.error}`;
    verdict = check.json(parsed);
  } else {
    verdict = check.stream(raw);
  }
  return verdict === true ? null : String(verdict);
}

async function run(check) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${check.path}`, {
      method: "POST",
      // For multipart (check.form) let fetch set the boundary Content-Type.
      headers: {
        ...(check.form ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${API_KEY}`,
      },
      body: check.form ? check.form() : JSON.stringify(check.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const raw = await res.text(); // reads streams to the end
    const ms = Date.now() - started;

    const failure = evaluate(check, res.status, raw);
    return failure === null
      ? { ...check, ok: true, ms }
      : { ...check, ok: false, ms, detail: failure };
  } catch (error) {
    return {
      ...check,
      ok: false,
      ms: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  if (!API_KEY) {
    console.error("SMOKE_API_KEY is required");
    process.exit(2);
  }
  assertAllowedBaseUrl(BASE_URL);
  const selected = ONLY.length
    ? checks.filter((c) => ONLY.includes(c.name))
    : checks;
  if (selected.length === 0) {
    console.error(`No checks match SMOKE_ONLY=${process.env.SMOKE_ONLY}`);
    process.exit(2);
  }

  console.log(`Smoke testing ${selected.length} routes on ${BASE_URL}\n`);
  const results = [];
  for (const check of selected) {
    // Sequential on purpose: keeps load, usage and log noise minimal.
    const result = await run(check);
    results.push(result);
    console.log(
      `${result.ok ? "PASS" : "FAIL"}  ${check.name.padEnd(22)} ${result.ms}ms${
        result.ok ? "" : `\n      ${result.detail}`
      }`
    );
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

// Only run when executed directly (so the checks can be imported in tests).
import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  });
}
