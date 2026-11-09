import { isInInboxFolder, normalizeInboxPath } from "./inbox-path";

describe("inbox path", () => {
  it("trims the configured folder", () => {
    expect(normalizeInboxPath("  _NoteCompanion/Inbox ")).toBe(
      "_NoteCompanion/Inbox"
    );
    expect(normalizeInboxPath(undefined)).toBe("");
  });

  it("matches files in the folder even when the setting has stray spaces", () => {
    expect(
      isInInboxFolder("_NoteCompanion/Inbox/call.m4a", " _NoteCompanion/Inbox ")
    ).toBe(true);
  });

  it("matches nested files and the folder itself", () => {
    expect(isInInboxFolder("Inbox/a/b.mp3", "Inbox")).toBe(true);
    expect(isInInboxFolder("Inbox", "Inbox")).toBe(true);
  });

  it("does not match sibling folders with the same prefix", () => {
    expect(isInInboxFolder("Inbox-old/a.mp3", "Inbox")).toBe(false);
  });

  it("matches nothing when no inbox is set", () => {
    expect(isInInboxFolder("a.mp3", "")).toBe(false);
    expect(isInInboxFolder("a.mp3", "   ")).toBe(false);
  });
});
