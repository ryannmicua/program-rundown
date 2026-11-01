export const unassignedSeedsMigration = {
  version: 13,
  sql: `CREATE TABLE demo_unassigned_seeds (program_id INTEGER PRIMARY KEY REFERENCES programs(id) ON DELETE CASCADE);`,
};
