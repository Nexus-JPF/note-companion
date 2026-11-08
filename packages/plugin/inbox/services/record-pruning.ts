import type { FileRecord, FileStatus } from "./record-manager";

/**
 * Retention policy for the on-disk record store (`_NoteCompanion/.records`).
 *
 * The store used to grow for the life of the vault: nothing ever removed an
 * entry, so a long-lived vault accumulated one JSON blob per file ever seen.
 * These bounds are deliberately explicit (and generous) rather than implicit —
 * a user should be able to read them and predict exactly what survives.
 *
 * Upgrade note: the first launch after this ships drops every terminal record
 * whose newest log entry is over RECORD_RETENTION_DAYS old, together with its
 * log entries and the Undo affordance on those old completed moves. Records
 * with no parseable timestamp go too. This is a one-time catch-up on a store
 * that was never pruned before; afterwards it stays within the bounds.
 *
 * Pruning runs only when the store is loaded, i.e. once per Obsidian session.
 * A vault left open for weeks can therefore sit above the bounds until the
 * next restart; that is intended, since pruning mid-session would delete log
 * entries out from under an open Inbox view.
 */
export const RECORD_RETENTION_DAYS = 30;
export const MAX_RETAINED_RECORDS = 500;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Statuses that will never change again. Only these are pruned; `queued` and
 * `processing` records describe work the plugin still believes is in flight.
 */
const TERMINAL_STATUSES: ReadonlySet<FileStatus> = new Set<FileStatus>([
  "completed",
  "error",
  "bypassed",
]);

export function isTerminalStatus(status: FileStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Log timestamps are written as "YYYY-MM-DD HH:mm:ss" (local time). Date.parse
 * handles that in Chromium, but normalise the separator so it is unambiguous.
 * Unparseable or absent timestamps sort as "oldest" so they age out first.
 */
export function parseLogTimestamp(timestamp: string | undefined): number {
  if (!timestamp) return 0;
  const parsed = Date.parse(timestamp.replace(" ", "T"));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Epoch ms of the most recent log entry on a record, or 0 if it has none. */
export function getLatestLogTime(record: FileRecord): number {
  let latest = 0;
  for (const log of Object.values(record.logs ?? {})) {
    const time = parseLogTimestamp(log?.timestamp);
    if (time > latest) latest = time;
  }
  return latest;
}

/**
 * Apply the retention policy to a map of records, returning a new map.
 *
 * Two bounds, applied in order:
 *  1. Age — terminal records whose newest log entry is older than
 *     RECORD_RETENTION_DAYS are dropped.
 *  2. Count — if more than MAX_RETAINED_RECORDS remain, the oldest terminal
 *     records are dropped until the store fits. Non-terminal records are never
 *     dropped, so the store can briefly exceed the cap while a huge batch is
 *     being processed; it settles once those records reach a terminal status.
 */
export function pruneRecords(
  records: Map<string, FileRecord>,
  now: number = Date.now()
): { records: Map<string, FileRecord>; removed: number } {
  const cutoff = now - RECORD_RETENTION_DAYS * MS_PER_DAY;

  const kept: Array<[string, FileRecord]> = [];
  let removed = 0;

  for (const entry of records.entries()) {
    const record = entry[1];
    if (isTerminalStatus(record.status) && getLatestLogTime(record) < cutoff) {
      removed++;
      continue;
    }
    kept.push(entry);
  }

  let overflow = kept.length - MAX_RETAINED_RECORDS;
  if (overflow > 0) {
    // Oldest terminal records first; everything else is untouchable.
    const prunable = kept
      .filter(([, record]) => isTerminalStatus(record.status))
      .sort((a, b) => getLatestLogTime(a[1]) - getLatestLogTime(b[1]));

    const doomed = new Set<string>();
    for (const [hash] of prunable) {
      if (overflow <= 0) break;
      doomed.add(hash);
      overflow--;
      removed++;
    }

    if (doomed.size > 0) {
      return {
        records: new Map(kept.filter(([hash]) => !doomed.has(hash))),
        removed,
      };
    }
  }

  return { records: new Map(kept), removed };
}
