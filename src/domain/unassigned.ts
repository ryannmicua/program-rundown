import type { DirectPart } from './parts.js';

export type ReviewPart = DirectPart & {
  programId: number;
  programTitle: string;
  eventName: string | null;
  targetLabel: string;
  targetPath: string;
};

export function awaitsNamedAssignment(part: Pick<DirectPart, 'kind' | 'value' | 'name' | 'intentionallyNotListed' | 'participant'>) {
  if (part.intentionallyNotListed) return false;
  if (part.kind === 'blank') return true;
  if (part.kind === 'role' || part.kind === 'structured') return !part.name.trim();
  if (part.kind === 'reference') return !part.participant?.name.trim();
  if (part.kind === 'text') return !part.value.trim();
  return false;
}

export function filterReviewParts(parts: ReviewPart[], query: string, programId: number | null) {
  const needle = query.trim().toLocaleLowerCase();
  return parts.filter(part => (programId == null || part.programId === programId) &&
    (!needle || `${part.programTitle} ${part.eventName || ''} ${part.targetPath} ${part.targetLabel} ${part.role} ${part.name} ${part.participant?.role || ''} ${part.participant?.name || ''} ${part.value} ${part.extraInfo}`.toLocaleLowerCase().includes(needle)));
}
