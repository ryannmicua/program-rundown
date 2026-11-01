export type DirectPart = {
  id: string; targetId: string; targetKind: 'item' | 'section' | 'mini-program' | 'footer';
  kind: 'blank' | 'text' | 'role' | 'structured'; value: string; role: string; name: string;
  extraInfo: string; intentionallyNotListed: boolean;
};
export type ListedPart = Omit<DirectPart, 'intentionallyNotListed'>;
export type FooterRole = { id: string; title: string };

export function validateParts(body: unknown, nodes: { id: string; kind: string }[]): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Send Parts and Footer roles as an object.';
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some(key => !['version', 'parts', 'footer'].includes(key)) || !Number.isSafeInteger(value.version) || Number(value.version) < 1) return 'Reload the saved Program before trying again.';
  if (!Array.isArray(value.parts) || value.parts.length > 600 || !Array.isArray(value.footer) || value.footer.length > 100) return 'Use at most 600 Parts and 100 Footer roles.';
  const nodeKinds = new Map(nodes.map(node => [node.id, node.kind]));
  const ids = new Set<string>();
  for (const raw of value.parts) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Invalid Part fields.';
    const part = raw as Record<string, unknown>;
    if (Object.keys(part).some(key => !['id','targetId','targetKind','kind','value','role','name','extraInfo','intentionallyNotListed'].includes(key))) return 'Invalid Part fields.';
    if (typeof part.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(part.id) || ids.has(part.id)) return 'Each Part needs a unique ID.';
    ids.add(part.id);
    const targetKind = part.targetKind;
    if (targetKind === 'footer' ? !value.footer.some((entry: any) => entry?.id === part.targetId) : nodeKinds.get(String(part.targetId)) !== targetKind) return 'A Part must belong to an existing Item, block, or Footer role.';
    if (!['item','section','mini-program','footer'].includes(String(targetKind)) || !['blank','text','role','structured'].includes(String(part.kind))) return 'Choose a supported Part form.';
    for (const key of ['value','role','name','extraInfo']) if (typeof part[key] !== 'string' || (part[key] as string).length > (key === 'extraInfo' ? 2000 : 500)) return 'Part text is too long.';
    if (typeof part.intentionallyNotListed !== 'boolean') return 'Choose whether the participant is intentionally not listed.';
    if (part.kind === 'role' && !String(part.role).trim()) return 'Enter a role for this Part.';
    if (part.kind === 'structured' && !String(part.role).trim()) return 'Enter a role for this Part.';
    if (part.kind === 'blank' && (part.value || part.role || part.name)) return 'A blank Part cannot contain participant text.';
  }
  for (const raw of value.footer) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Invalid Footer role.';
    const role = raw as Record<string, unknown>;
    if (Object.keys(role).some(key => !['id','title'].includes(key)) || typeof role.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(role.id) || typeof role.title !== 'string' || !role.title.trim() || role.title.length > 200) return 'Footer role titles are required and may contain up to 200 characters.';
  }
  if (new Set(value.footer.map((entry: any) => entry?.id)).size !== value.footer.length) return 'Each Footer role needs a unique ID.';
  return null;
}
