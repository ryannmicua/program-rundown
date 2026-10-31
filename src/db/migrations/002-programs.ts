export const programsMigration = {
  version: 2,
  sql: `
    CREATE TABLE programs (
      id INTEGER PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES identities(id),
      title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
      date TEXT,
      start_time TEXT,
      end_time TEXT,
      status TEXT NOT NULL DEFAULT 'Draft' CHECK(status = 'Draft'),
      version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
      seed_key TEXT UNIQUE
    );
    CREATE INDEX programs_owner ON programs(owner_id);
  `,
};
