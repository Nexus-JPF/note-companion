import { TFile } from "obsidian";

const FILE_HASH_LENGTH = 12;

/**
 * Stable 12-char hex id for inbox queue keys.
 * Not cryptographic — path + mtime only needs a short deterministic fingerprint.
 */
export function fingerprint(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x811c9dc5);
  }
  const hex =
    (h1 >>> 0).toString(16).padStart(8, "0") +
    (h2 >>> 0).toString(16).padStart(8, "0");
  return hex.slice(0, FILE_HASH_LENGTH);
}

export class IdService {
  private static instance: IdService;

  public static getInstance(): IdService {
    if (!IdService.instance) {
      IdService.instance = new IdService();
    }
    return IdService.instance;
  }

  public generateFileHash(file: TFile): string {
    return fingerprint(`${file.path}-${file.stat.mtime}`);
  }

  public generateEventId(fileHash: string, timestamp: number): string {
    return `evt-${fileHash}-${timestamp}`;
  }

  public generateStepId(fileHash: string, type: string): string {
    return `step-${fileHash}-${type}`;
  }

  public validateHash(hash: string): boolean {
    return typeof hash === "string" && hash.length === FILE_HASH_LENGTH;
  }
}
