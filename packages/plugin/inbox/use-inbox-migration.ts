export interface UseInboxMigrationInput {
  useInboxMigrated: boolean;
}

export interface UseInboxMigrationResult {
  useInbox: true;
  useInboxMigrated: true;
}

/**
 * `useInbox` was previously saved but never read anywhere, so any value already
 * on disk before this migration shipped doesn't reflect real user intent. Runs
 * once per settings file: forces `useInbox` on (preserving today's always-on
 * inbox processing) and marks the migration done so it never runs again.
 */
export function migrateUseInbox(
  settings: UseInboxMigrationInput
): UseInboxMigrationResult | undefined {
  if (settings.useInboxMigrated) {
    return undefined;
  }
  return { useInbox: true, useInboxMigrated: true };
}
