# Plugin release checklist

Unit tests do not cover how the plugin looks and behaves in Obsidian. Several bugs have only shown up on a real build (a missing Top up section, a clipped button, a link in the wrong place), so every release gets a short manual pass.

## How a release works

Actions > **Manual Plugin Release** > Run workflow, then pick `patch`, `minor` or `major` (`.github/workflows/manual-release.yml`). The workflow:

- bumps the version in `manifest.json` and `packages/plugin/package.json` (the `chore(release)` commit). **Do not bump it by hand.**
- generates release notes from the commits since the previous version
- tags, builds, creates the GitHub release and triggers the Docker build

It ships **whatever is on master when you press the button**, and it pushes the version bump to master, so do not merge anything while it runs.

## Before you run it

- [ ] Every PR you want in is merged, and anything not tested in Obsidian waits for the next patch.
- [ ] For each PR with a late push, check the merge includes it: a push right before merging may not reach the PR. `gh pr view <n> --json headRefOid` should match your last commit.
- [ ] CI on master is green (`build`, `obsidian-scan`).

## Smoke test on a build of master

Use a demo vault. Obsidian 1.13+ builds settings from `getSettingDefinitions()` and skips the React settings screens, so check the screen users on current Obsidian actually see. Check an older Obsidian too if the release touches settings (`minAppVersion` is in `manifest.json`).

**Settings (General)**
- [ ] The license key is shown, and the **Usage and plan** section shows the real plan status, tokens, audio minutes and the reset date.
- [ ] **Top up**: the name and description are visible, the three buttons are not clipped (narrow the window too), and each opens its Stripe checkout. Close without paying.
- [ ] Every setting added or changed in this release: change it, close Settings, reopen: it persisted.

**Recording to note**
- [ ] Settings > Inbox: "Send recordings to inbox" on, "Audio default template" set to `lecture_notes`. Process a lecture: the note is formatted, the audio player is there, the transcript callout is kept at the end, tags and the backup link are present.
- [ ] "Study note from recordings" set to `flash_cards`: a `... - Flashcards` note appears beside the lecture, the cards expand on click, and the `Flashcards:` link in the lecture sits above the `---` / "Link to original file" line with the tags last.
- [ ] A non-English recording (French): the note, its headings and the cards come out in French.
- [ ] A failure reads as a message, not a bare status code (for example, an invalid license key).

**No lecture audio?** Write about 400 words of lecture text and generate a file on macOS:

```bash
say -v Daniel -r 170 -o lecture_en.m4a --data-format=aac -f lecture_en.txt
say -v "Eddy (French (France))" -r 170 -o lecture_fr.m4a --data-format=aac -f lecture_fr.txt
```

Drop the files into the inbox folder. Use text with testable facts (definitions, numbers, a sequence) so you can check the transcript and any generated cards against it. A clean synthetic voice tests the pipeline, not noisy classroom audio.

## After the release

- [ ] The tag and GitHub release exist, and `manifest.json` at the tag shows the new version.
- [ ] The last fix you merged is in the tag: `git show <tag>:<path-to-file> | grep <a line from the fix>`.
- [ ] Update the plugin in a vault and confirm the version shown in Obsidian.
