import { migrateUseInbox } from "./use-inbox-migration";

describe("migrateUseInbox", () => {
  it("forces useInbox on when the migration hasn't run yet", () => {
    expect(migrateUseInbox({ useInboxMigrated: false })).toEqual({
      useInbox: true,
      useInboxMigrated: true,
    });
  });

  it("does nothing once the migration has already run", () => {
    expect(migrateUseInbox({ useInboxMigrated: true })).toBeUndefined();
  });
});
