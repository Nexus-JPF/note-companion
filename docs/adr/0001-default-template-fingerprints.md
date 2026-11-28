# Recognise unedited default templates by a shipped list of fingerprints

Default templates are plain files in the user's vault, written once and never touched again, so a fix to a default only reached users who deleted the file. To update them without overwriting anyone's edits, the plugin ships the fingerprint of every text each default has had in a release (`packages/plugin/lib/default-template-fingerprints.ts`, generated from git history). A vault file that matches any of them, ignoring line endings and trailing whitespace on each line, is an unedited default and is replaced by the current one; a file that matches none is an edited template and is never overwritten.

## Considered Options

- **Record the version and fingerprint per vault when the plugin writes a template** (in `data.json`). Rejected: the template files and `data.json` do not always travel together between devices (sync tools, a copied vault). A device with the file but no record would see an untouched template as edited, and one with a stale record could overwrite a newer edit. A shipped list depends only on the file's own text, so every device reaches the same answer.
- **A version number written into the template file** (a comment or property). Rejected: the template text is sent to the model, so the marker would be part of the prompt, and users delete or reformat such lines.
- **A hand-bumped version number in code.** Rejected: easy to forget when changing a template. The text is the version.

## Consequences

- The list is **append-only**. When a default's text changes, run `node packages/plugin/scripts/generate-template-fingerprints.mjs` and commit the result. A test fails until the current text of every default is the last entry, and fails if any entry disappears.
- Texts from before the December 2024 monorepo move are not in the list. A vault that still holds one of those is treated as edited: the heads-up shows instead of a silent update, which is the safe side.
- Anything the plugin cannot identify with certainty counts as edited. It is never replaced without the user's action.
