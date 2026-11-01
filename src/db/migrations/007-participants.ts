export const participantsMigration = {
  version: 7,
  sql: `
    CREATE TABLE participants (
      id INTEGER PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
      seed_key TEXT UNIQUE,
      role TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      honorific TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT '',
      organization TEXT NOT NULL DEFAULT '',
      subtitle TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE parts_next (
      program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_kind TEXT NOT NULL CHECK(target_kind IN ('item', 'section', 'mini-program', 'footer')),
      kind TEXT NOT NULL CHECK(kind IN ('blank', 'text', 'role', 'structured', 'reference')),
      value TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      extra_info TEXT NOT NULL DEFAULT '',
      intentionally_not_listed INTEGER NOT NULL DEFAULT 0 CHECK(intentionally_not_listed IN (0, 1)),
      position INTEGER NOT NULL CHECK(position >= 0),
      participant_id INTEGER REFERENCES participants(id) ON DELETE RESTRICT,
      reference_mode TEXT CHECK(reference_mode IN ('name', 'role')),
      PRIMARY KEY (program_id, id),
      CHECK((kind = 'reference' AND participant_id IS NOT NULL AND reference_mode IS NOT NULL) OR (kind != 'reference' AND participant_id IS NULL AND reference_mode IS NULL))
    );
    INSERT INTO parts_next (program_id, id, target_id, target_kind, kind, value, role, name, extra_info, intentionally_not_listed, position)
      SELECT program_id, id, target_id, target_kind, kind, value, role, name, extra_info, intentionally_not_listed, position FROM parts;
    DROP TABLE parts;
    ALTER TABLE parts_next RENAME TO parts;
    CREATE INDEX parts_target ON parts(program_id, target_kind, target_id, position);
    CREATE INDEX participants_owner ON participants(owner_id, role, name);
    CREATE INDEX parts_participant ON parts(participant_id);
    CREATE TABLE demo_participant_seeds (program_id INTEGER PRIMARY KEY REFERENCES programs(id) ON DELETE CASCADE);
  `,
};
