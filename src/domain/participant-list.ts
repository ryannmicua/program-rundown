export type ParticipantAssignment = {
  programId: number; programTitle: string; partId: string; targetKind: string; targetId: string;
  targetLabel: string; footerTitle?: string; kind: string; value: string; role: string; name: string;
  participantId: number | null; referenceMode: string | null; participantRole?: string; participantName?: string;
  honorific?: string; position?: string; organization?: string; subtitle?: string;
};

export function buildParticipantList(rows: ParticipantAssignment[]) {
  const named = new Map<string, { participantId: number; role: string; name: string; honorific: string; position: string; organization: string; subtitle: string; assignments: ParticipantAssignment[] }>();
  const waiting = new Map<string, { participantId?: number; role: string; assignments: ParticipantAssignment[] }>();
  const text: { value: string; assignments: ParticipantAssignment[] }[] = [];
  for (const row of rows) {
    const location = { ...row, url: `/programs/${row.programId}#part-${encodeURIComponent(row.partId)}` };
    if (row.kind === 'blank' || (!row.value && !row.role && !row.name && row.participantId == null)) continue;
    if (row.kind === 'reference' && row.participantId != null) {
      if (row.participantName) {
        const key = String(row.participantId);
        const item = named.get(key) || { participantId: row.participantId, role: row.participantRole || '', name: row.participantName, honorific: row.honorific || '', position: row.position || '', organization: row.organization || '', subtitle: row.subtitle || '', assignments: [] };
        item.assignments.push(location); named.set(key, item);
      } else {
        const key = String(row.participantId); const item = waiting.get(key) || { participantId: row.participantId, role: row.participantRole || '', assignments: [] };
        item.assignments.push(location); waiting.set(key, item);
      }
    } else if (row.kind === 'text' && row.value.trim()) text.push({ value: row.value, assignments: [location] });
    else if (row.kind === 'structured' && row.name.trim()) text.push({ value: row.name, assignments: [location] });
    else if (row.kind === 'role' || row.kind === 'structured') {
      const key = row.kind === 'structured' ? `direct:${row.partId}` : `direct:${row.partId}`;
      waiting.set(key, { role: row.role, assignments: [location] });
    }
  }
  return { namedParticipants: [...named.values()], textAssignments: text, awaitingName: [...waiting.values()] };
}
