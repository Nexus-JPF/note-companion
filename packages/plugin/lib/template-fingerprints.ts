import { KNOWN_DEFAULT_FINGERPRINTS } from "./default-template-fingerprints";

/**
 * Fingerprints of default template text, used to tell an unedited copy of a
 * default (current or older) from a template the user changed. See
 * docs/adr/0001-default-template-fingerprints.md for why this is a shipped
 * list and not something recorded per vault.
 */

/**
 * The text compared for equality: line endings and trailing spaces and tabs on
 * every line are ignored, because sync tools and editors change those without
 * the user having edited anything. Everything else counts as an edit.
 */
export function normalizeTemplateText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "");
}

/**
 * cyrb53, a small non-cryptographic hash. Collisions between the few dozen
 * texts we ever fingerprint are not a practical concern, and no secrecy is
 * needed. scripts/generate-template-fingerprints.mjs has the same function and
 * the tests check the two agree.
 */
export function fingerprintText(text: string): string {
  const input = normalizeTemplateText(text);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
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

/**
 * - current: the file is an unedited copy of this release's default
 * - outdated: an unedited copy of an older release's default
 * - edited: matches no release's default
 */
export type TemplateState = "current" | "outdated" | "edited";

export function classifyDefaultTemplate(
  name: string,
  fileText: string,
  currentDefaultText: string
): TemplateState {
  const fingerprint = fingerprintText(fileText);
  if (fingerprint === fingerprintText(currentDefaultText)) return "current";
  return KNOWN_DEFAULT_FINGERPRINTS[name]?.includes(fingerprint) ? "outdated" : "edited";
}
