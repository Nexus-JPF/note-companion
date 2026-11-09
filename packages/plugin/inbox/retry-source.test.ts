jest.mock("obsidian", () => ({ Notice: class {} }));

import {
  getAttachmentRetryCandidates,
  isStaleContainer,
} from "./retry-source";

describe("isStaleContainer", () => {
  const base = {
    containerPath: "_NoteCompanion/Errors/memo.md",
    attachmentPath: "_NoteCompanion/Processed/Attachments/memo.m4a",
  };

  it("is true for an empty or whitespace-only container of a distinct attachment", () => {
    expect(isStaleContainer({ ...base, content: "" })).toBe(true);
    expect(isStaleContainer({ ...base, content: " \n\t" })).toBe(true);
  });

  it("is false when the container has content", () => {
    expect(isStaleContainer({ ...base, content: "hello" })).toBe(false);
  });

  it("is false when there is no tracked attachment (regular note)", () => {
    expect(isStaleContainer({ ...base, attachmentPath: undefined, content: "" })).toBe(false);
    expect(isStaleContainer({ ...base, attachmentPath: null, content: "" })).toBe(false);
  });

  it("is false when the container is the attachment itself", () => {
    expect(
      isStaleContainer({
        containerPath: base.attachmentPath,
        attachmentPath: base.attachmentPath,
        content: "",
      })
    ).toBe(false);
  });

  it("never treats a non-markdown file as a container", () => {
    expect(
      isStaleContainer({ ...base, containerPath: "x/memo.m4a", content: "" })
    ).toBe(false);
  });
});

describe("getAttachmentRetryCandidates", () => {
  const attachmentsPath = "_NoteCompanion/Processed/Attachments";

  it("uses the tracked attachment path when the container is empty", () => {
    expect(
      getAttachmentRetryCandidates({
        attachmentPath: `${attachmentsPath}/memo.m4a`,
        originalName: "memo",
        attachmentsPath,
        containerEmpty: true,
      })
    ).toEqual([`${attachmentsPath}/memo.m4a`]);
  });

  it("returns nothing when the container has content (failure was after extraction)", () => {
    expect(
      getAttachmentRetryCandidates({
        attachmentPath: `${attachmentsPath}/memo.m4a`,
        originalName: "memo",
        attachmentsPath,
        containerEmpty: false,
      })
    ).toEqual([]);
  });

  it("falls back to media extensions in the attachments folder for legacy records", () => {
    const candidates = getAttachmentRetryCandidates({
      originalName: "memo",
      attachmentsPath,
      containerEmpty: true,
    });
    expect(candidates).toContain(`${attachmentsPath}/memo.m4a`);
    expect(candidates).toContain(`${attachmentsPath}/memo.mp3`);
    expect(candidates.every((p) => p.startsWith(`${attachmentsPath}/memo.`))).toBe(true);
    expect(candidates).not.toContain(`${attachmentsPath}/memo.md`);
  });

  it("also probes the extra folders for legacy records", () => {
    const candidates = getAttachmentRetryCandidates({
      originalName: "memo",
      attachmentsPath,
      extraFolders: ["_NoteCompanion/Errors", "_NoteCompanion/Bypassed"],
      containerEmpty: true,
    });
    expect(candidates).toContain("_NoteCompanion/Errors/memo.m4a");
    expect(candidates).toContain("_NoteCompanion/Bypassed/memo.m4a");
    expect(candidates).toContain(`${attachmentsPath}/memo.m4a`);
  });

  it("returns nothing for a legacy record without a name or attachments folder", () => {
    expect(
      getAttachmentRetryCandidates({ originalName: "", attachmentsPath, containerEmpty: true })
    ).toEqual([]);
    expect(
      getAttachmentRetryCandidates({ originalName: "memo", attachmentsPath: "", containerEmpty: true })
    ).toEqual([]);
  });
});
