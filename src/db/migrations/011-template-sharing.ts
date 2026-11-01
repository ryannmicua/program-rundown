export const templateSharingMigration = {
  version: 11,
  sql: `ALTER TABLE program_templates ADD COLUMN shared INTEGER NOT NULL DEFAULT 0 CHECK(shared IN (0, 1));`,
};
