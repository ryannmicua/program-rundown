import type { ContentNode } from './content.js';
import type { DirectPart, FooterRole } from './parts.js';

export type TemplateSnapshot = { nodes: ContentNode[]; parts: DirectPart[]; footer: FooterRole[] };
export function createTemplateSnapshot(nodes: ContentNode[], parts: DirectPart[], footer: FooterRole[]): TemplateSnapshot {
  return {
    nodes: nodes.map(node => node.kind === 'mini-program' ? { ...node, date: null, startTime: null, endTime: null } : { ...node }),
    footer: footer.map(role => ({ ...role })),
    parts: parts.map(part => {
      const role = part.kind === 'role' || part.kind === 'structured' ? part.role : part.kind === 'reference' && part.referenceMode === 'role' ? part.participant?.role || '' : '';
      return { ...part, kind: role ? 'role' : 'blank', value: '', role, name: '', intentionallyNotListed: Boolean(part.intentionallyNotListed), participantId: undefined, referenceMode: undefined, participant: undefined };
    }),
  };
}
