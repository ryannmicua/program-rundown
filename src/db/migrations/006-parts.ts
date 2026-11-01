export const partsMigration = {
  version: 6,
  sql: `
    CREATE TABLE footer_roles (
      program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      title TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      PRIMARY KEY (program_id, id)
    );
    CREATE TABLE parts (
      program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_kind TEXT NOT NULL CHECK(target_kind IN ('item', 'section', 'mini-program', 'footer')),
      kind TEXT NOT NULL CHECK(kind IN ('blank', 'text', 'role', 'structured')),
      value TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      extra_info TEXT NOT NULL DEFAULT '',
      intentionally_not_listed INTEGER NOT NULL DEFAULT 0 CHECK(intentionally_not_listed IN (0, 1)),
      position INTEGER NOT NULL CHECK(position >= 0),
      PRIMARY KEY (program_id, id)
    );
    CREATE INDEX parts_target ON parts(program_id, target_kind, target_id, position);
    CREATE TABLE demo_parts_seeds (program_id INTEGER PRIMARY KEY REFERENCES programs(id) ON DELETE CASCADE);
  `,
};
