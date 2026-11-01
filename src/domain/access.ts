export function programAccessSql(alias = 'programs') {
  return `(${alias}.owner_id = ? OR EXISTS (SELECT 1 FROM events e WHERE e.id = ${alias}.event_id AND e.owner_id = ?))`;
}

export function participantAccessSql(alias = 'participants') {
  return `(${alias}.owner_id = ? OR EXISTS (SELECT 1 FROM parts ref JOIN programs p ON p.id = ref.program_id WHERE ref.participant_id = ${alias}.id AND ${programAccessSql('p')}))`;
}
