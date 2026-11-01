export type ContentNode = {
  id: string;
  parentId: string | null;
  kind: 'section' | 'mini-program' | 'item';
  label: string;
  detail: string;
  startTime: string | null;
  endTime: string | null;
  date?: string | null;
  blockLabel?: string;
};

export const contentLimits = { nodes: 300, label: 200, detail: 10000, text: 60000, blockLabel: 80, subtitle: 500 };
export const contentBodyLimit = '512kb';

export function validateContent(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Send a rundown as an object.';
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some(key => !['version', 'nodes'].includes(key))) return 'Only rundown fields can be changed.';
  if (!Number.isSafeInteger(value.version) || Number(value.version) < 1) return 'Reload the saved Draft before trying again.';
  if (!Array.isArray(value.nodes) || value.nodes.length > contentLimits.nodes) return `Use at most ${contentLimits.nodes} Sections, mini-programs, and Items.`;
  const ids = new Map<string, ContentNode>();
  let text = 0;
  for (const raw of value.nodes) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Invalid rundown fields.';
    const node = raw as Record<string, unknown>;
    if (Object.keys(node).some(key => !['id', 'parentId', 'kind', 'label', 'detail', 'startTime', 'endTime', 'date', 'blockLabel'].includes(key))) return 'Invalid rundown fields.';
    if (typeof node.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(node.id) || ids.has(node.id)) return 'Each block and Item needs a unique ID.';
    if (typeof node.kind !== 'string' || !['section', 'mini-program', 'item'].includes(node.kind)) return 'Use Sections, mini-programs, and Items only.';
    if (typeof node.label !== 'string' || node.label.length > contentLimits.label || (node.kind !== 'section' && !node.label.trim())) return 'Mini-program titles and Item labels are required; labels may contain up to 200 characters.';
    if (typeof node.detail !== 'string' || node.detail.length > contentLimits.detail || (node.kind !== 'item' && node.detail !== '')) return 'Detail is free text for Items, up to 10000 characters.';
    if (node.blockLabel !== undefined && (typeof node.blockLabel !== 'string' || node.blockLabel.length > contentLimits.blockLabel)) return 'Block labels may contain up to 80 characters.';
    if (node.kind === 'item' && (node.blockLabel || node.date)) return 'Only Sections and mini-programs can have block labels; only mini-programs can have a date.';
    if (node.kind === 'section' && node.date) return 'Only mini-program Headers can have a date.';
    if (node.date != null && node.date !== '' && (typeof node.date !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(node.date) || Number.isNaN(Date.parse(`${node.date}T00:00:00Z`)) || new Date(`${node.date}T00:00:00Z`).toISOString().slice(0, 10) !== node.date)) return 'Enter a real mini-program date as YYYY-MM-DD, or leave it blank.';
    text += node.label.length + node.detail.length + String(node.blockLabel || '').length;
    if (text > contentLimits.text) return 'Keep rundown labels, block labels, and Detail to 60000 characters in total.';
    for (const time of [node.startTime, node.endTime]) if (time !== null && (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return 'Enter times as HH:MM, or leave them blank.';
    ids.set(node.id, node as unknown as ContentNode);
  }
  for (const node of ids.values()) {
    if (node.parentId !== null && (typeof node.parentId !== 'string' || !ids.has(node.parentId))) return 'Every nested block must belong to this Program.';
    const parent = node.parentId === null ? undefined : ids.get(node.parentId);
    if (node.kind === 'item' && parent?.kind !== 'section') return 'Items belong to a Section.';
    if (node.kind !== 'item' && parent && parent.kind === 'item') return 'Sections and mini-programs belong inside Sections or mini-programs.';
    if (node.parentId === node.id) return 'Blocks cannot contain themselves.';
    let ancestor = parent;
    const visited = new Set([node.id]);
    while (ancestor) {
      if (visited.has(ancestor.id)) return 'A block cannot be nested inside itself.';
      visited.add(ancestor.id);
      ancestor = ancestor.parentId ? ids.get(ancestor.parentId) : undefined;
    }
  }
  return null;
}

export function moveSibling(nodes: ContentNode[], id: string, direction: -1 | 1): ContentNode[] {
  const node = nodes.find(item => item.id === id);
  if (!node) return nodes;
  const siblings = nodes.filter(item => item.parentId === node.parentId);
  const index = siblings.findIndex(item => item.id === id);
  const target = siblings[index + direction];
  if (!target) return nodes;
  const subtree = (root: ContentNode) => {
    const result = [root];
    for (const child of nodes.filter(item => item.parentId === root.id)) result.push(...subtree(child));
    return result;
  };
  const ordered = [...siblings];
  [ordered[index], ordered[index + direction]] = [ordered[index + direction], ordered[index]];
  const chunks = ordered.map(subtree).flat();
  const movedIds = new Set(chunks.map(item => item.id));
  const positions = nodes.map((item, position) => ({ item, position })).filter(({ item }) => movedIds.has(item.id)).map(({ position }) => position);
  const next = [...nodes];
  positions.forEach((position, offset) => { next[position] = chunks[offset]; });
  return next;
}
