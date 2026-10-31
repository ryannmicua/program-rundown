export const publicationMigration = {
  version: 4,
  sql: `
    CREATE TABLE program_publications (
      program_id INTEGER PRIMARY KEY REFERENCES programs(id) ON DELETE CASCADE,
      published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
};
