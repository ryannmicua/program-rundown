import type { DirectPart } from './parts.js';

export type CopyMode = 'without-participant' | 'everything';

export function copiedPart(part: DirectPart, mode: CopyMode): Omit<DirectPart, 'id' | 'targetId' | 'targetKind'> {
  const copy = { ...part };
  delete (copy as Partial<DirectPart>).id;
  delete (copy as Partial<DirectPart>).targetId;
  delete (copy as Partial<DirectPart>).targetKind;
  if (mode === 'everything') return copy;
  if (part.kind === 'reference') {
    return { ...copy, kind: 'role', value: '', role: part.participant?.role || part.role, name: '', intentionallyNotListed: false, participantId: undefined, referenceMode: undefined, participant: undefined };
  }
  if (part.kind === 'structured') return { ...copy, kind: 'role', value: '', name: '', intentionallyNotListed: false };
  if (part.kind === 'role') return { ...copy, value: '', name: '', intentionallyNotListed: false };
  return { ...copy, kind: 'blank', value: '', role: '', name: '', intentionallyNotListed: false };
}
