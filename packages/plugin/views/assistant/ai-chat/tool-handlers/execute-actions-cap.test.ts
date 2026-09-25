import { EXECUTE_ACTIONS_MAX_FILES, capFilePaths } from "./execute-actions-cap";

describe("capFilePaths", () => {
  it("passes through unchanged when under the cap", () => {
    const paths = ["a.md", "b.md", "c.md"];
    const result = capFilePaths(paths);
    expect(result).toEqual({
      filePaths: paths,
      requestedCount: 3,
      truncatedCount: 0,
    });
  });

  it("passes through unchanged when exactly at the cap", () => {
    const paths = Array.from({ length: EXECUTE_ACTIONS_MAX_FILES }, (_, i) => `${i}.md`);
    const result = capFilePaths(paths);
    expect(result.filePaths).toHaveLength(EXECUTE_ACTIONS_MAX_FILES);
    expect(result.truncatedCount).toBe(0);
  });

  it("truncates and reports the overflow when over the default cap", () => {
    const paths = Array.from({ length: EXECUTE_ACTIONS_MAX_FILES + 5 }, (_, i) => `${i}.md`);
    const result = capFilePaths(paths);
    expect(result.filePaths).toHaveLength(EXECUTE_ACTIONS_MAX_FILES);
    expect(result.filePaths).toEqual(paths.slice(0, EXECUTE_ACTIONS_MAX_FILES));
    expect(result.requestedCount).toBe(EXECUTE_ACTIONS_MAX_FILES + 5);
    expect(result.truncatedCount).toBe(5);
  });

  it("respects a custom max", () => {
    const paths = ["a.md", "b.md", "c.md"];
    const result = capFilePaths(paths, 2);
    expect(result.filePaths).toEqual(["a.md", "b.md"]);
    expect(result.truncatedCount).toBe(1);
  });

  it("handles an empty list", () => {
    const result = capFilePaths([]);
    expect(result).toEqual({ filePaths: [], requestedCount: 0, truncatedCount: 0 });
  });
});
