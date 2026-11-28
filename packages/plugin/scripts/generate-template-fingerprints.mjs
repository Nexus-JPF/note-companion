#!/usr/bin/env node
/**
 * Regenerates lib/default-template-fingerprints.ts from git history: the
 * fingerprint of every distinct text each default template has had on the
 * given ref (default origin/master), oldest first, ending with the current one.
 *
 *   node packages/plugin/scripts/generate-template-fingerprints.mjs [ref]
 *   node packages/plugin/scripts/generate-template-fingerprints.mjs --dump <template.md> <commit> <outFile> [commit]
 *
 * The list is append-only (a test enforces it): when a default changes, run
 * this and commit the result. Run from anywhere inside the repository.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: here, encoding: "utf8" }).trim();
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });

const FUNCTIONS = {
  getMeetingNoteTemplateContent: "meeting_note.md",
  getResearchPaperTemplateContent: "research_paper.md",
  getYoutubeVideoTemplateContent: "youtube_video.md",
  getYoutubeSummaryTemplateContent: "youtube_summary.md",
  getYoutubeKeyConceptsTemplateContent: "youtube_key_concepts.md",
  getYoutubeQaTemplateContent: "youtube_qa.md",
  getYoutubeTimestampedOutlineTemplateContent: "youtube_timestamped_outline.md",
  getEnhanceTemplateContent: "enhance.md",
  getLectureNotesTemplateContent: "lecture_notes.md",
  getQuizTemplateContent: "quiz.md",
  getFlashCardsTemplateContent: "flash_cards.md",
};

// Before the templates became functions (76e2a4db) four of them were literals inside checkAndCreateTemplates.
const INLINE = {
  meetingNoteTemplatePath: "meeting_note.md",
  youtubeVideoTemplatePath: "youtube_video.md",
  enhanceTemplatePath: "enhance.md",
  researchPaperTemplatePath: "research_paper.md",
};

// Same function as lib/template-fingerprints.ts.
const normalize = text => text.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "");
function fingerprint(text) {
  const input = normalize(text);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

const render = literalSource => new Function(`return \`${literalSource}\`;`)();

function sourceAt(commit) {
  for (const path of ["packages/plugin/fileUtils.ts", "fileUtils.ts"]) {
    try { return git("show", `${commit}:${path}`); } catch { /* try the next path */ }
  }
  return null;
}

/** { "name.md": rendered text } for every default template found in this commit's fileUtils.ts. */
function textsAt(commit) {
  const src = sourceAt(commit);
  const out = {};
  if (!src) return out;
  // Templates may call small helpers (getYoutube...Instructions), so evaluate them in one scope.
  const helpers = [...src.matchAll(/function (get\w+)\(\): string \{\n([\s\S]*?)\n\}\n/g)];
  const scope = helpers.map(m => `function ${m[1]}() {\n${m[2]}\n}`).join("\n");
  for (const m of helpers) {
    const name = FUNCTIONS[m[1]];
    if (name) out[name] = new Function(`${scope}\nreturn ${m[1]}();`)();
  }
  for (const [variable, name] of Object.entries(INLINE)) {
    if (out[name]) continue;
    // A template literal: anything except a bare backtick or backslash, or a backslash escape.
    const m = src.match(new RegExp(`create\\(\\s*${variable},\\s*\`((?:[^\`\\\\]|\\\\[\\s\\S])*)\`\\s*\\)`));
    if (m) out[name] = render(m[1]);
  }
  return out;
}

const args = process.argv.slice(2);
if (args[0] === "--dump") {
  const [, name, commit, outFile] = args;
  const text = textsAt(commit)[name];
  if (text === undefined) throw new Error(`${name} not found at ${commit}`);
  writeFileSync(outFile, text);
  console.log(`wrote ${name} @ ${commit} (${text.length} chars, fingerprint ${fingerprint(text)})`);
  process.exit(0);
}

const ref = args[0] ?? "origin/master";
const commits = git("log", "--reverse", "--format=%h", ref, "--", "packages/plugin/fileUtils.ts", "fileUtils.ts").split("\n").filter(Boolean);
const history = {};
for (const commit of commits) {
  for (const [name, text] of Object.entries(textsAt(commit))) {
    const fp = fingerprint(text);
    const list = (history[name] ??= []);
    if (!list.some(entry => entry.fp === fp)) list.push({ fp, commit });
  }
}

const body = Object.entries(history)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, list]) => `  "${name}": [\n${list.map(({ fp, commit }) => `    "${fp}", // ${commit}`).join("\n")}\n  ],`)
  .join("\n");

writeFileSync(
  join(root, "packages/plugin/lib/default-template-fingerprints.ts"),
  `/**
 * Fingerprint of every distinct text each default template has had in a
 * release, oldest first, the current one last. APPEND-ONLY: never delete or
 * reorder an entry. Generated by scripts/generate-template-fingerprints.mjs
 * from git history; when a default changes, run it again and commit the result.
 * Fingerprints ignore line endings and trailing whitespace on every line.
 * Texts from before the Dec 2024 monorepo move are not covered, so a vault that
 * still holds one of those is treated as edited (the safe side).
 */
export const KNOWN_DEFAULT_FINGERPRINTS: Record<string, readonly string[]> = {
${body}
};
`
);
console.log(Object.entries(history).map(([n, l]) => `${n}: ${l.length}`).join("\n"));
