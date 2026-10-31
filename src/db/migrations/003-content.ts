export const contentMigration = {
  version: 3,
  sql: `
    CREATE TABLE content_nodes (
      program_id INTEGER NOT NULL REFERENCES programs(id),
      id TEXT NOT NULL,
      parent_id TEXT,
      kind TEXT NOT NULL CHECK(kind IN ('section', 'item')),
      label TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      start_time TEXT,
      end_time TEXT,
      position INTEGER NOT NULL CHECK(position >= 0),
      PRIMARY KEY (program_id, id),
      FOREIGN KEY (program_id, parent_id) REFERENCES content_nodes(program_id, id) DEFERRABLE INITIALLY DEFERRED,
      CHECK((kind = 'section' AND parent_id IS NULL AND detail = '') OR (kind = 'item' AND parent_id IS NOT NULL))
    );
    CREATE INDEX content_order ON content_nodes(program_id, parent_id, position);
    CREATE TABLE demo_content_seeds (
      program_id INTEGER PRIMARY KEY REFERENCES programs(id)
    );
  `,
};
