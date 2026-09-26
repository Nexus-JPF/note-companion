// Each file triggers a full LLM call (tag/folder/name recommendation), so cap how
// many a single confirmation can process to avoid silently burning through a
// user's quota on a large or accidental request.
export const EXECUTE_ACTIONS_MAX_FILES = 20;

export interface CappedFilePaths {
  filePaths: string[];
  requestedCount: number;
  truncatedCount: number;
}

export function capFilePaths(
  filePaths: string[],
  maxFiles: number = EXECUTE_ACTIONS_MAX_FILES
): CappedFilePaths {
  const capped = filePaths.slice(0, maxFiles);
  return {
    filePaths: capped,
    requestedCount: filePaths.length,
    truncatedCount: filePaths.length - capped.length,
  };
}
