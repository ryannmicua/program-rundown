export const movePartSeedsMigration = {
  version: 10,
  sql: `
    CREATE TABLE demo_move_part_seeds (program_id INTEGER PRIMARY KEY REFERENCES programs(id) ON DELETE CASCADE);
  `,
};
