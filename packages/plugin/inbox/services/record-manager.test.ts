/**
 * End-to-end check of the record store against an in-memory vault: dismissal
 * must survive a "restart" (a fresh RecordManager reading the file back), and
 * the store must be pruned on load.
 */
import { RecordManager, type FileRecord } from "./record-manager";
import { MAX_RETAINED_RECORDS, RECORD_RETENTION_DAYS } from "./record-pruning";

const RECORD_PATH = "_NoteCompanion/.records";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function stamp(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * MS_PER_DAY);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Minimal stand-in for the slice of the Obsidian App that RecordManager uses. */
function makeApp(files: Record<string, string>) {
  return {
    vault: {
      adapter: {
        exists: (p: string) => Promise.resolve(p in files),
        read: (p: string) => Promise.resolve(files[p]),
        write: (p: string, c: string) => {
          files[p] = c;
          return Promise.resolve();
        },
        mkdir: () => Promise.resolve(),
      },
      create: (p: string, c: string) => {
        files[p] = c;
        return Promise.resolve();
      },
      getAbstractFileByPath: () => null,
    },
  } as never;
}

function seed(records: Array<Partial<FileRecord> & { id: string }>): string {
  return JSON.stringify(
    Object.fromEntries(
      records.map(r => [
        r.id,
        {
          tags: [],
          formatted: false,
          originalName: `${r.id}.pdf`,
          status: "bypassed",
          logs: {
            "Processing failed": {
              timestamp: stamp(1),
              error: {
                message: "Bypassed due to No content available",
                action: "Processing failed",
              },
            },
          },
          ...r,
        },
      ])
    )
  );
}

/** Each test gets a fresh singleton, since RecordManager caches one per process. */
function freshManager(files: Record<string, string>): RecordManager {
  (RecordManager as unknown as { instance?: RecordManager }).instance =
    undefined;
  return RecordManager.getInstance(makeApp(files));
}

/** Let loadRecords() settle, then fire the 1s debounced save. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeAll(() => {
  jest.useFakeTimers();
  (global as unknown as { window: unknown }).window = global;
});

afterAll(() => {
  jest.useRealTimers();
  delete (global as unknown as { window?: unknown }).window;
});

describe("RecordManager dismissal", () => {
  it("clears an issue from the active set while keeping it in the log", async () => {
    const files = { [RECORD_PATH]: seed([{ id: "aaa" }, { id: "bbb" }]) };
    const manager = freshManager(files);
    await settle();

    expect(manager.getActiveRecords()).toHaveLength(2);

    expect(manager.dismissRecord("aaa")).toBe(true);
    expect(manager.dismissRecord("aaa")).toBe(false); // already dismissed
    expect(manager.dismissRecord("nope")).toBe(false); // unknown hash

    expect(manager.getActiveRecords().map(r => r.id)).toEqual(["bbb"]);
    // History is preserved: the full log still has both.
    expect(manager.getAllRecords()).toHaveLength(2);
  });

  it("dismisses a whole backlog in one call", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}` }));
    const files = { [RECORD_PATH]: seed(ids) };
    const manager = freshManager(files);
    await settle();

    expect(manager.dismissRecords(ids.map(r => r.id))).toBe(12);
    expect(manager.dismissRecords(ids.map(r => r.id))).toBe(0);
    expect(manager.getActiveRecords()).toHaveLength(0);
    expect(manager.getAllRecords()).toHaveLength(12);
  });

  it("survives a restart", async () => {
    const files = { [RECORD_PATH]: seed([{ id: "aaa" }, { id: "bbb" }]) };
    const first = freshManager(files);
    await settle();
    first.dismissRecords(["aaa", "bbb"]);

    // Flush the debounced write to the vault file.
    jest.advanceTimersByTime(1000);
    await settle();
    expect(JSON.parse(files[RECORD_PATH]).aaa.dismissed).toBe(true);

    // Restart: a brand new manager reading the same file back.
    const second = freshManager(files);
    await settle();
    expect(second.getActiveRecords()).toHaveLength(0);
    expect(second.getAllRecords()).toHaveLength(2);
  });

  it("re-surfaces a dismissed file when it is processed again", async () => {
    const files = { [RECORD_PATH]: seed([{ id: "aaa" }]) };
    const manager = freshManager(files);
    await settle();
    manager.dismissRecord("aaa");
    expect(manager.getActiveRecords()).toHaveLength(0);

    manager.startTracking("aaa", "aaa.pdf");
    expect(manager.getActiveRecords().map(r => r.id)).toEqual(["aaa"]);
  });
});

describe("RecordManager pruning on load", () => {
  it("drops stale terminal records and rewrites the file", async () => {
    const stale = {
      timestamp: stamp(RECORD_RETENTION_DAYS + 5),
    };
    const files = {
      [RECORD_PATH]: seed([
        { id: "fresh" },
        {
          id: "stale",
          status: "completed",
          logs: { "Processing completed": stale } as never,
        },
      ]),
    };

    const manager = freshManager(files);
    await settle();

    expect(manager.getAllRecords().map(r => r.id)).toEqual(["fresh"]);

    jest.advanceTimersByTime(1000);
    await settle();
    expect(Object.keys(JSON.parse(files[RECORD_PATH]))).toEqual(["fresh"]);
  });

  it("caps the store at MAX_RETAINED_RECORDS", async () => {
    const many = Array.from({ length: MAX_RETAINED_RECORDS + 25 }, (_, i) => ({
      id: `r${String(i).padStart(4, "0")}`,
      status: "completed" as const,
      logs: {
        "Processing completed": { timestamp: stamp(25 - i / 100) },
      } as never,
    }));
    const files = { [RECORD_PATH]: seed(many) };

    const manager = freshManager(files);
    await settle();

    expect(manager.getAllRecords()).toHaveLength(MAX_RETAINED_RECORDS);
  });
});
