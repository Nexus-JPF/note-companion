import { TFile } from "obsidian";
import { fingerprint, IdService } from "./id-service";

jest.mock("obsidian", () => ({
  TFile: class TFile {},
}));

function mockFile(path: string, mtime: number): TFile {
  return { path, stat: { mtime } } as TFile;
}

describe("fingerprint", () => {
  it("returns a 12-character hex string", () => {
    expect(fingerprint("Inbox/note.md-1710000000000")).toMatch(/^[0-9a-f]{12}$/);
  });

  it("is stable for the same input", () => {
    expect(fingerprint("a")).toBe(fingerprint("a"));
  });

  it("differs for different inputs", () => {
    expect(fingerprint("a")).not.toBe(fingerprint("b"));
  });
});

describe("IdService", () => {
  beforeEach(() => {
    (IdService as unknown as { instance?: IdService }).instance = undefined;
  });

  it("returns the same instance", () => {
    expect(IdService.getInstance()).toBe(IdService.getInstance());
  });

  it("hashes path and mtime into a valid queue key", () => {
    const service = IdService.getInstance();
    const hash = service.generateFileHash(mockFile("Inbox/note.md", 1710000000000));

    expect(service.validateHash(hash)).toBe(true);
    expect(hash).toBe(
      service.generateFileHash(mockFile("Inbox/note.md", 1710000000000))
    );
    expect(hash).not.toBe(
      service.generateFileHash(mockFile("Inbox/other.md", 1710000000000))
    );
  });

  it("rejects hashes that are not 12 characters", () => {
    expect(IdService.getInstance().validateHash("abc")).toBe(false);
  });
});
