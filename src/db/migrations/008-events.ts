export const eventsMigration = {
  version: 8,
  sql: `
    CREATE TABLE events (
      id INTEGER PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
      start_date TEXT,
      end_date TEXT,
      group_by_date INTEGER NOT NULL DEFAULT 0 CHECK(group_by_date IN (0, 1)),
      seed_key TEXT UNIQUE
    );
    CREATE INDEX events_owner ON events(owner_id);
    ALTER TABLE programs ADD COLUMN event_id INTEGER REFERENCES events(id) ON DELETE SET NULL;
    ALTER TABLE programs ADD COLUMN event_position INTEGER;
    CREATE INDEX programs_event_order ON programs(event_id, event_position);
    CREATE TABLE demo_event_seeds (event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE);
  `,
};
