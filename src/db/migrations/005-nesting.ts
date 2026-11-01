export const nestingMigration = {
  version: 5,
  sql: `
    ALTER TABLE programs ADD COLUMN subtitle TEXT NOT NULL DEFAULT '' CHECK(length(subtitle) <= 500);
    CREATE TABLE content_nodes_next (
      program_id INTEGER NOT NULL REFERENCES programs(id),
      id TEXT NOT NULL,
      parent_id TEXT,
      kind TEXT NOT NULL CHECK(kind IN ('section', 'mini-program', 'item')),
      label TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      start_time TEXT,
      end_time TEXT,
      date TEXT,
      block_label TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL CHECK(position >= 0),
      PRIMARY KEY (program_id, id),
      FOREIGN KEY (program_id, parent_id) REFERENCES content_nodes_next(program_id, id) DEFERRABLE INITIALLY DEFERRED,
      CHECK((kind = 'item' AND parent_id IS NOT NULL AND date IS NULL AND block_label = '') OR (kind = 'section' AND detail = '' AND date IS NULL) OR (kind = 'mini-program' AND detail = ''))
    );
    INSERT INTO content_nodes_next (program_id, id, parent_id, kind, label, detail, start_time, end_time, position)
      SELECT program_id, id, parent_id, kind, label, detail, start_time, end_time, position FROM content_nodes;
    DROP TABLE content_nodes;
    ALTER TABLE content_nodes_next RENAME TO content_nodes;
    CREATE INDEX content_order ON content_nodes(program_id, parent_id, position);
  `,
};
