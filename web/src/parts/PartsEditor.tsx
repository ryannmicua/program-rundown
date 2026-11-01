import { useEffect, useRef, useState } from 'react';
import type { ContentNode } from '../../../src/domain/content.js';
import type { DirectPart, FooterRole } from '../../../src/domain/parts.js';
import type { Program } from '../../../src/domain/programs.js';
import { participant } from '../editor/Rundown.js';

type Draft = { version: number; parts: DirectPart[]; footer: FooterRole[] };
const makePart = (targetId: string, targetKind: DirectPart['targetKind']): DirectPart => ({ id: crypto.randomUUID(), targetId, targetKind, kind: 'blank', value: '', role: '', name: '', extraInfo: '', intentionallyNotListed: false });
export function PartsEditor({ program, nodes, initialParts, initialFooter, onSaved, onChange, onDirtyChange, reload }: { program: Program; nodes: ContentNode[]; initialParts: DirectPart[]; initialFooter: FooterRole[]; onSaved(program: Program, parts: DirectPart[], footer: FooterRole[]): void; onChange(parts: DirectPart[], footer: FooterRole[]): void; onDirtyChange(dirty: boolean): void; reload(): Promise<void> }) {
  const draftKey = `program-rundown:parts-draft:${program.id}`;
  function readDraft() {
    try { const draft = JSON.parse(window.sessionStorage.getItem(draftKey) || 'null'); if (Number.isSafeInteger(draft?.version) && Array.isArray(draft?.parts) && Array.isArray(draft?.footer)) return draft as Draft; } catch { /* use saved data when browser storage is unavailable */ }
    return undefined;
  }
  function clearDraft() { try { window.sessionStorage.removeItem(draftKey); } catch { /* saved server state is authoritative */ } }
  const onTargets = (list: DirectPart[]) => { const targets = new Map(nodes.map(node => [node.id, node.kind])); return list.filter(part => part.targetKind === 'footer' || targets.get(part.targetId) === part.targetKind); };
  const [parts, setParts] = useState(initialParts);
  const [footer, setFooter] = useState(initialFooter);
  const [kept, setKept] = useState<Omit<Draft, 'version'>>();
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [slow, setSlow] = useState(false);
  const [invalidId, setInvalidId] = useState('');
  const loadedParts = useRef(initialParts);
  useEffect(() => { try { if (dirty && loadedParts.current === initialParts) window.sessionStorage.setItem(draftKey, JSON.stringify({ version: program.version, parts, footer })); } catch { /* current page state remains available */ } }, [parts, footer, dirty, draftKey, program.version]);
  useEffect(() => {
    loadedParts.current = initialParts;
    const draft = readDraft();
    if (draft?.version === program.version) { setParts(draft.parts); setFooter(draft.footer); setKept(undefined); setDirty(true); }
    else { const unsaved = dirty ? { parts, footer } : draft; if (unsaved) setKept(unsaved); setParts(initialParts); setFooter(initialFooter); setDirty(false); }
    setConflict(false); setError(''); setInvalidId('');
  }, [initialParts, initialFooter]);
  useEffect(() => { setParts(onTargets); }, [nodes]);
  useEffect(() => { onChange(parts, footer); }, [parts, footer]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty]);
  function editPart(id: string, fields: Partial<DirectPart>) { setParts(current => current.map(part => part.id === id ? { ...part, ...fields } : part)); setDirty(true); setInvalidId(''); setMessage(''); }
  function addPart(targetId: string, targetKind: DirectPart['targetKind']) { setParts(current => [...current, makePart(targetId, targetKind)]); setDirty(true); setMessage(''); }
  function addFooter() { const role = { id: crypto.randomUUID(), title: '' }; setFooter(current => [...current, role]); addPart(role.id, 'footer'); }
  async function save() {
    const invalidFooter = footer.find(role => !role.title.trim());
    const invalidPart = parts.find(part => ['role', 'structured'].includes(part.kind) && !part.role.trim());
    if (invalidFooter || invalidPart) { setInvalidId(invalidFooter?.id || invalidPart!.id); setError('Complete the highlighted role title before saving.'); return; }
    setBusy(true); setSlow(false); setError(''); setMessage('');
    const slowTimer = window.setTimeout(() => setSlow(true), 1800);
    try {
      const response = await fetch(`/api/programs/${program.id}/parts`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: program.version, parts, footer }) });
      const data = await response.json();
      if (!response.ok) { if (response.status === 409) setConflict(true); setError(response.status === 401 ? 'Your session ended. Your Parts are kept on this page. Sign in again, then review and save them.' : response.status === 403 ? 'This account cannot edit this Program. Sign out and use the configured coordinator account.' : data.error || 'Could not save Parts. Your entries are kept.'); return; }
      const saved = { ...program, version: data.version };
      setParts(data.parts); setFooter(data.footer); setKept(undefined); setDirty(false); clearDraft(); onSaved(saved, data.parts, data.footer); setMessage('Parts and Footer saved. Review the Rundown preview, then publish when ready.');
    } catch { setError(window.navigator.onLine ? 'Could not connect. Your Parts are kept. Try again.' : 'You are offline. Your Parts are kept. Reconnect, then try again.'); }
    finally { window.clearTimeout(slowTimer); setSlow(false); setBusy(false); }
  }
  const partEditor = (targetId: string, targetKind: DirectPart['targetKind']) => <div className="part-list">
    {parts.filter(part => part.targetId === targetId && part.targetKind === targetKind).map(part => <fieldset className="part-fields" key={part.id}>
      <legend>Participant</legend>
      <label>Participant form<select aria-label="Participant form" value={part.kind} onChange={event => editPart(part.id, { kind: event.target.value as DirectPart['kind'], value: '', role: '', name: '' })}><option value="blank">Blank</option><option value="text">Text or group</option><option value="role">Role</option><option value="structured">Role and optional name</option></select></label>
      {part.kind === 'text' && <label>Participant text<input aria-label="Participant text" maxLength={500} value={part.value} onChange={event => editPart(part.id, { value: event.target.value })}/></label>}
      {(part.kind === 'role' || part.kind === 'structured') && <label>Role<input aria-label="Role" maxLength={500} value={part.role} aria-invalid={invalidId === part.id} aria-describedby={invalidId === part.id ? `part-error-${part.id}` : undefined} onChange={event => editPart(part.id, { role: event.target.value })}/>{invalidId === part.id && <span className="field-error" id={`part-error-${part.id}`}>Enter a role for this participant.</span>}</label>}
      {part.kind === 'structured' && <label>Name (optional)<input aria-label="Participant name" maxLength={500} value={part.name} onChange={event => editPart(part.id, { name: event.target.value })}/></label>}
      <label>Part extra info (optional)<textarea aria-label="Part extra info" maxLength={2000} value={part.extraInfo} onChange={event => editPart(part.id, { extraInfo: event.target.value })}/></label>
      <label><input type="checkbox" checked={part.intentionallyNotListed} onChange={event => editPart(part.id, { intentionallyNotListed: event.target.checked })}/> Intentionally not listed</label>
      <button type="button" onClick={() => { setParts(current => current.filter(entry => entry.id !== part.id)); setDirty(true); }}>Remove participant</button>
    </fieldset>)}
    <button type="button" onClick={() => addPart(targetId, targetKind)}>Add participant</button>
  </div>;
  function keptSummary(draft: Omit<Draft, 'version'>) {
    const titles = new Map<string, string>([...nodes.map(node => [node.id, node.label || 'Untitled'] as const), ...draft.footer.map(role => [role.id, `Footer: ${role.title || 'Untitled role'}`] as const)]);
    return [...draft.footer.filter(role => !draft.parts.some(part => part.targetId === role.id)).map(role => `Footer: ${role.title || 'Untitled role'}`),
      ...draft.parts.map(part => `${titles.get(part.targetId) || 'Removed entry'}: ${participant(part) || '(blank)'}${part.intentionallyNotListed ? ' - intentionally not listed' : ''}${part.extraInfo ? `\n${part.extraInfo}` : ''}`)].join('\n\n');
  }
  function renderTarget(node: ContentNode) {
    const title = node.label || (node.kind === 'section' ? 'Unheaded Section' : node.kind === 'item' ? 'New Item' : 'Untitled mini-program');
    return <section className="part-target" key={node.id} aria-label={`Participants for ${title}`}><h4>{title}</h4>{partEditor(node.id, node.kind)}</section>;
  }
  return <section className="card parts-editor" aria-label="Parts and Footer editor">
    <h2>Parts and Footer roles</h2>
    <p>Each Item, Section, mini-program, and Footer role can have independent participant entries. Save to keep changes.</p>
    {error && <div role="alert"><p>{error}</p>{conflict ? <button type="button" disabled={busy} onClick={() => void reload()}>Reload saved Program</button> : dirty && !invalidId && <button type="button" disabled={busy} onClick={() => void save()}>Try saving Parts again</button>}{error.startsWith('Your session ended') && <> <a href="/signin" target="_blank" rel="noreferrer">Open sign-in in another tab</a></>}</div>}
    {message && <p role="status">{message}</p>}
    {kept && <aside className="kept-header"><h3>Your unsaved Parts</h3><p>This Program changed elsewhere. The saved Parts and Footer roles are shown below. Review them, then reapply your entries if you still want them.</p><pre className="note-text">{keptSummary(kept)}</pre>{!conflict && <button type="button" disabled={busy} onClick={() => { setParts(onTargets(kept.parts)); setFooter(kept.footer); setKept(undefined); setDirty(true); setMessage(''); }}>Reapply my Parts entries</button>}</aside>}
    <fieldset className="parts-form" disabled={busy || conflict}>
    <legend className="sr-only">Participants and Footer roles</legend>
    {!nodes.length && <p>Add a Section or mini-program in the Rundown editor to assign participants.</p>}
    <div>{nodes.map(renderTarget)}</div>
    <section className="footer-role-editor" aria-label="Footer standing roles"><h3>Footer standing roles</h3>
      {footer.map((role, index) => <div className="part-target" key={role.id}>
        <label>Footer role title<input aria-label="Footer role title" required maxLength={200} value={role.title} aria-invalid={invalidId === role.id} aria-describedby={invalidId === role.id ? `footer-error-${role.id}` : undefined} onChange={event => { setFooter(current => current.map(entry => entry.id === role.id ? { ...entry, title: event.target.value } : entry)); setDirty(true); setInvalidId(''); }}/>{invalidId === role.id && <span className="field-error" id={`footer-error-${role.id}`}>Enter a Footer role title.</span>}</label>
        <div className="node-actions"><button type="button" disabled={index === 0} onClick={() => { setFooter(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; }); setDirty(true); }}>Move role up</button><button type="button" disabled={index === footer.length - 1} onClick={() => { setFooter(current => { const next = [...current]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; }); setDirty(true); }}>Move role down</button><button type="button" onClick={() => { setFooter(current => current.filter(entry => entry.id !== role.id)); setParts(current => current.filter(part => part.targetId !== role.id)); setDirty(true); }}>Remove role</button></div>
        {partEditor(role.id, 'footer')}
      </div>)}
      {!footer.length && <p>No Footer roles yet. Add a standing role such as Pianist or Program Coordinator.</p>}
      <button type="button" onClick={addFooter}>Add Footer role</button>
    </section>
    <button className="primary" type="button" disabled={!dirty} onClick={() => void save()}>{busy ? slow ? 'Still saving Parts… Your changes are kept.' : 'Saving Parts…' : 'Save Parts and Footer'}</button>
    </fieldset>
    {busy && slow && <div className="loading-progress" aria-label="Saving progress"/>}
  </section>;
}
