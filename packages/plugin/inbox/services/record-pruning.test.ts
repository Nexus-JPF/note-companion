import type { FileRecord, FileStatus } from "./record-manager";
import {
  MAX_RETAINED_RECORDS,
  RECORD_RETENTION_DAYS,
  pruneRecords,
} from "./record-pruning";

const NOW = Date.parse("2026-10-15T12:00:00");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function fmt(epoch: number): string {
  const d = new Date(epoch);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function record(
  id: string,
  status: FileStatus,
  ageInDays: number | null
): FileRecord {
  return {
    id,
    tags: [],
    formatted: false,
    originalName: `${id}.md`,
    status,
    file: null,
    logs:
      ageInDays === null
        ? ({} as FileRecord["logs"])
        : ({
            "Processing completed": {
              timestamp: fmt(NOW - ageInDays * MS_PER_DAY),
            },
          } as unknown as FileRecord["logs"]),
  };
}

function mapOf(...records: FileRecord[]): Map<string, FileRecord> {
  return new Map(records.map(r => [r.id, r]));
}

describe("pruneRecords", () => {
  it("keeps terminal records inside the retention window", () => {
    const input = mapOf(
      record("a", "completed", RECORD_RETENTION_DAYS - 1),
      record("b", "error", 1),
      record("c", "bypassed", 0)
    );
    const { records, removed } = pruneRecords(input, NOW);
    expect(removed).toBe(0);
    expect([...records.keys()].sort()).toEqual(["a", "b", "c"]);
  });

  it("drops terminal records past the retention window", () => {
    const input = mapOf(
      record("old-error", "error", RECORD_RETENTION_DAYS + 1),
      record("old-bypassed", "bypassed", 365),
      record("recent", "completed", 2)
    );
    const { records, removed } = pruneRecords(input, NOW);
    expect(removed).toBe(2);
    expect([...records.keys()]).toEqual(["recent"]);
  });

  it("never drops queued or processing records, however old", () => {
    const input = mapOf(
      record("queued", "queued", 400),
      record("processing", "processing", 400),
      record("done", "completed", 400)
    );
    const { records, removed } = pruneRecords(input, NOW);
    expect(removed).toBe(1);
    expect([...records.keys()].sort()).toEqual(["processing", "queued"]);
  });

  it("drops records with unparseable or missing timestamps", () => {
    const input = mapOf(record("no-logs", "completed", null));
    const { records, removed } = pruneRecords(input, NOW);
    expect(removed).toBe(1);
    expect(records.size).toBe(0);
  });

  it("enforces the max-count bound, oldest terminal records first", () => {
    const overflow = 5;
    const input = mapOf(
      ...Array.from({ length: MAX_RETAINED_RECORDS + overflow }, (_, i) =>
        // index 0 is the oldest (29 days), the rest get progressively newer
        record(`r${String(i).padStart(4, "0")}`, "completed", 29 - i / 1000)
      )
    );
    const { records, removed } = pruneRecords(input, NOW);
    expect(removed).toBe(overflow);
    expect(records.size).toBe(MAX_RETAINED_RECORDS);
    for (let i = 0; i < overflow; i++) {
      expect(records.has(`r${String(i).padStart(4, "0")}`)).toBe(false);
    }
    expect(records.has(`r${String(overflow).padStart(4, "0")}`)).toBe(true);
  });

  it("lets non-terminal records exceed the max count rather than dropping them", () => {
    const input = mapOf(
      ...Array.from({ length: MAX_RETAINED_RECORDS + 3 }, (_, i) =>
        record(`q${i}`, "queued", 0)
      )
    );
    const { records, removed } = pruneRecords(input, NOW);
    expect(removed).toBe(0);
    expect(records.size).toBe(MAX_RETAINED_RECORDS + 3);
  });

  it("does not mutate the input map", () => {
    const input = mapOf(record("old", "completed", 400));
    pruneRecords(input, NOW);
    expect(input.size).toBe(1);
  });
});
