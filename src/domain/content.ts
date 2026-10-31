export type ContentNode = {
  id: string;
  parentId: string | null;
  kind: 'section' | 'item';
  label: string;
  detail: string;
  startTime: string | null;
  endTime: string | null;
};

export const contentLimits = { nodes: 300, label: 200, detail: 10000, text: 60000 };
export const contentBodyLimit = '512kb';

// Array order defines sibling order; line breaks are text, never extra nodes.
export function validateContent(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Send a rundown as an object.';
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some(key => !['version', 'nodes'].includes(key))) return 'Only rundown fields can be changed.';
  if (!Number.isSafeInteger(value.version) || Number(value.version) < 1) return 'Reload the saved Draft before trying again.';
  if (!Array.isArray(value.nodes) || value.nodes.length > contentLimits.nodes) return `Use at most ${contentLimits.nodes} Sections and Items.`;
  const ids = new Map<string, ContentNode>();
  let text = 0;
  for (const node of value.nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node) || Object.keys(node).some(key => !['id', 'parentId', 'kind', 'label', 'detail', 'startTime', 'endTime'].includes(key))) return 'Invalid rundown fields.';
    if (typeof node.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(node.id) || ids.has(node.id)) return 'Each Section and Item needs a unique ID.';
    if (!['section', 'item'].includes(node.kind)) return 'Use Sections and Items only.';
    if (typeof node.label !== 'string' || node.label.length > contentLimits.label || (node.kind === 'item' && !node.label.trim())) return `Item labels are required; labels may contain up to ${contentLimits.label} characters.`;
    if (typeof node.detail !== 'string' || node.detail.length > contentLimits.detail || (node.kind === 'section' && node.detail !== '')) return `Detail is free text for Items, up to ${contentLimits.detail} characters.`;
    text += node.label.length + node.detail.length;
    if (text > contentLimits.text) return `Keep rundown labels and Detail to ${contentLimits.text} characters in total.`;
    for (const time of [node.startTime, node.endTime]) {
      if (time !== null && (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return 'Enter times as HH:MM, or leave them blank.';
    }
    ids.set(node.id, node);
  }
  for (const node of ids.values()) {
    if (node.kind === 'section' ? node.parentId !== null : typeof node.parentId !== 'string' || ids.get(node.parentId)?.kind !== 'section') return 'Sections belong at the root; Items belong to a Section.';
  }
  return null;
}

export function moveSibling(nodes: ContentNode[], id: string, direction: -1 | 1): ContentNode[] {
  const index = nodes.findIndex(node => node.id === id);
  if (index < 0) return nodes;
  const siblings = nodes.map((node, position) => ({ node, position })).filter(({ node }) => node.parentId === nodes[index].parentId);
  const target = siblings[siblings.findIndex(({ node }) => node.id === id) + direction]?.position;
  if (target === undefined) return nodes;
  const next = [...nodes];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
