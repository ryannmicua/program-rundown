export const participantListSeedsMigration = {
  version: 12,
  sql: `CREATE TABLE demo_participant_list_seeds (program_id INTEGER PRIMARY KEY REFERENCES programs(id) ON DELETE CASCADE);`,
};
