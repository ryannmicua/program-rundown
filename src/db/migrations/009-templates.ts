export const templatesMigration = {
  version: 9,
  sql: `
    CREATE TABLE program_templates (
      id INTEGER PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX program_templates_owner ON program_templates(owner_id, id DESC);
    CREATE TABLE demo_template_seeds (
      owner_id INTEGER PRIMARY KEY REFERENCES identities(id) ON DELETE CASCADE,
      template_id INTEGER REFERENCES program_templates(id) ON DELETE SET NULL
    );
  `,
};
