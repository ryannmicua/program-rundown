import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ContentNode } from '../../../src/domain/content.js';
import type { DirectPart, FooterRole } from '../../../src/domain/parts.js';
import type { Program } from '../../../src/domain/programs.js';
import { participant } from '../editor/Rundown.js';

type Draft = { version: number; parts: DirectPart[]; footer: FooterRole[] };
type ParticipantDefinition = { id: number; role: string; name: string; honorific: string; position: string; organization: string; subtitle: string; programs: { id: number; title: string; status: string }[] };
type ParticipantFields = Omit<ParticipantDefinition, 'id' | 'programs'>;
const emptyParticipant: ParticipantFields = { role: '', name: '', honorific: '', position: '', organization: '', subtitle: '' };
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
  const [definitions, setDefinitions] = useState<ParticipantDefinition[]>([]);
  const [definitionsState, setDefinitionsState] = useState<'loading' | 'ready' | 'error' | 'offline'>('loading');
  const [definitionsSlow, setDefinitionsSlow] = useState(false);
  const [definitionsError, setDefinitionsError] = useState('');
  const [definitionQuery, setDefinitionQuery] = useState('');
  const [selectionQueries, setSelectionQueries] = useState<Record<string, string>>({});
  const definitionDraftKey = `program-rundown:participant-draft:${program.id}`;
  const [definitionDraft, setDefinitionDraft] = useState<ParticipantFields>(() => { try { return JSON.parse(window.sessionStorage.getItem(definitionDraftKey) || 'null')?.fields || emptyParticipant; } catch { return emptyParticipant; } });
  const [editingDefinition, setEditingDefinition] = useState<number | undefined>(() => { try { return JSON.parse(window.sessionStorage.getItem(definitionDraftKey) || 'null')?.id; } catch { return undefined; } });
  const [definitionBusy, setDefinitionBusy] = useState(false);
  const [definitionMessage, setDefinitionMessage] = useState('');
  const [definitionFormError, setDefinitionFormError] = useState('');
  const loadedParts = useRef(initialParts);
  async function loadDefinitions() {
    setDefinitionsState('loading'); setDefinitionsError(''); setDefinitionsSlow(false);
    const slowTimer = window.setTimeout(() => setDefinitionsSlow(true), 1800);
    try {
      const response = await fetch('/api/participants');
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.participants)) throw Error(response.status === 401 ? 'Your session ended. Sign in again to load saved Participants.' : response.status === 403 ? 'This account cannot view saved Participants. Sign in with the configured coordinator account.' : 'Could not load saved Participants. Try again.');
      setDefinitions(data.participants); setDefinitionsState('ready');
    } catch (error) { setDefinitionsState(window.navigator.onLine ? 'error' : 'offline'); setDefinitionsError(error instanceof Error ? error.message : 'Could not load Participants.'); }
    finally { window.clearTimeout(slowTimer); setDefinitionsSlow(false); }
  }
  useEffect(() => { void loadDefinitions(); }, []);
  useEffect(() => { try { if (Object.values(definitionDraft).some(Boolean)) window.sessionStorage.setItem(definitionDraftKey, JSON.stringify({ id: editingDefinition, fields: definitionDraft })); else window.sessionStorage.removeItem(definitionDraftKey); } catch { /* keep the form available in this page */ } }, [definitionDraft, editingDefinition, definitionDraftKey]);
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
  function beginDefinitionEdit(definition: ParticipantDefinition) { setEditingDefinition(definition.id); setDefinitionDraft({ role: definition.role, name: definition.name, honorific: definition.honorific, position: definition.position, organization: definition.organization, subtitle: definition.subtitle }); setDefinitionFormError(''); setDefinitionMessage(''); }
  function resetDefinitionForm() { setEditingDefinition(undefined); setDefinitionDraft(emptyParticipant); setDefinitionFormError(''); try { window.sessionStorage.removeItem(definitionDraftKey); } catch { /* the form is already cleared */ } }
  async function saveDefinition(event: FormEvent) {
    event.preventDefault(); setDefinitionBusy(true); setDefinitionFormError(''); setDefinitionMessage('');
    try {
      const response = await fetch(editingDefinition ? `/api/participants/${editingDefinition}` : '/api/participants', { method: editingDefinition ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(definitionDraft) });
      const data = await response.json();
      if (!response.ok) { setDefinitionFormError(response.status === 401 ? 'Your session ended. Your Participant details are kept on this page. Sign in again, then review and save them.' : response.status === 403 && data.code !== 'participant-not-owner' ? 'This account cannot manage Participant definitions. Sign out and use the configured coordinator account.' : data.error || 'Could not save this Participant.'); return; }
      const saved = data.participant as ParticipantDefinition;
      setDefinitions(current => editingDefinition ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved].sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)));
      if (editingDefinition) setParts(current => current.map(part => part.participantId === saved.id ? { ...part, participant: saved } : part));
      setDefinitionMessage(editingDefinition ? 'Participant saved. Its references now show the updated definition.' : 'Participant created. Select it on any Item, block, or Footer entry.'); resetDefinitionForm();
    } catch { setDefinitionFormError(window.navigator.onLine ? 'Could not connect. Your Participant details are kept. Try again.' : 'You are offline. Your Participant details are kept. Reconnect, then try again.'); }
    finally { setDefinitionBusy(false); }
  }
  async function deleteDefinition(definition: ParticipantDefinition) {
    setDefinitionFormError(''); setDefinitionMessage('');
    try {
      const response = await fetch(`/api/participants/${definition.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (!response.ok) { const data = await response.json(); setDefinitionFormError(data.error || 'Could not delete this Participant.'); return; }
      setDefinitions(current => current.filter(item => item.id !== definition.id));
      setParts(current => current.map(part => part.participantId === definition.id ? { ...part, kind: 'blank', value: '', role: '', name: '', participantId: null, referenceMode: null } : part));
      if (editingDefinition === definition.id) resetDefinitionForm();
      setDefinitionMessage('Participant deleted. Its entries are now blank; save Parts to confirm those changes.'); setDirty(true);
    } catch { setDefinitionFormError(window.navigator.onLine ? 'Could not connect. Try deleting the Participant again.' : 'You are offline. Reconnect, then try again.'); }
  }
  async function save() {
    const invalidFooter = footer.find(role => !role.title.trim());
    const invalidPart = parts.find(part => (['role', 'structured'].includes(part.kind) && !part.role.trim()) || (part.kind === 'reference' && part.participantId == null));
    if (invalidFooter || invalidPart) { setInvalidId(invalidFooter?.id || invalidPart!.id); setError(invalidFooter || invalidPart!.kind !== 'reference' ? 'Complete the highlighted role title before saving.' : 'Choose the highlighted saved Participant before saving.'); return; }
    setBusy(true); setSlow(false); setError(''); setMessage('');
    const slowTimer = window.setTimeout(() => setSlow(true), 1800);
    try {
      const response = await fetch(`/api/programs/${program.id}/parts`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: program.version, parts: parts.map(({ participant: _details, ...part }) => part), footer }) });
      const data = await response.json();
      if (!response.ok) { if (response.status === 409) setConflict(true); setError(response.status === 401 ? 'Your session ended. Your Parts are kept on this page. Sign in again, then review and save them.' : response.status === 403 ? 'This account cannot edit this Program. Sign out and use the configured coordinator account.' : data.error || 'Could not save Parts. Your entries are kept.'); return; }
      const saved = { ...program, version: data.version };
      setParts(data.parts); setFooter(data.footer); setKept(undefined); setDirty(false); clearDraft(); onSaved(saved, data.parts, data.footer); setMessage('Parts and Footer saved. Review the Rundown preview, then publish when ready.'); void loadDefinitions();
    } catch { setError(window.navigator.onLine ? 'Could not connect. Your Parts are kept. Try again.' : 'You are offline. Your Parts are kept. Reconnect, then try again.'); }
    finally { window.clearTimeout(slowTimer); setSlow(false); setBusy(false); }
  }
  const partEditor = (targetId: string, targetKind: DirectPart['targetKind']) => <div className="part-list">
    {parts.filter(part => part.targetId === targetId && part.targetKind === targetKind).map(part => <fieldset className="part-fields" key={part.id}>
      <legend>Participant</legend>
      <label>Participant form<select aria-label="Participant form" value={part.kind} onChange={event => { const kind = event.target.value as DirectPart['kind']; editPart(part.id, kind === 'reference' ? { kind, value: '', role: '', name: '', participantId: definitions[0]?.id ?? null, referenceMode: 'name', participant: definitions[0] } : { kind, value: '', role: '', name: '', participantId: null, referenceMode: null, participant: undefined }); }}><option value="blank">Blank</option><option value="text">Text or group</option><option value="role">Role</option><option value="structured">Role and optional name</option>{(definitions.length > 0 || part.kind === 'reference') && <option value="reference">Saved Participant</option>}</select></label>
      {part.kind === 'text' && <label>Participant text<input aria-label="Participant text" maxLength={500} value={part.value} onChange={event => editPart(part.id, { value: event.target.value })}/></label>}
      {(part.kind === 'role' || part.kind === 'structured') && <label>Role<input aria-label="Role" maxLength={500} value={part.role} aria-invalid={invalidId === part.id} aria-describedby={invalidId === part.id ? `part-error-${part.id}` : undefined} onChange={event => editPart(part.id, { role: event.target.value })}/>{invalidId === part.id && <span className="field-error" id={`part-error-${part.id}`}>Enter a role for this participant.</span>}</label>}
      {part.kind === 'structured' && <label>Name (optional)<input aria-label="Participant name" maxLength={500} value={part.name} onChange={event => editPart(part.id, { name: event.target.value })}/></label>}
      {part.kind === 'reference' && (() => { const query = selectionQueries[part.id] || ''; const matches = definitions.filter(item => `${item.name} ${item.role} ${item.organization}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())); return <><label>Find Participant to reuse<input aria-label="Find Participant to reuse" value={query} onChange={event => setSelectionQueries(current => ({ ...current, [part.id]: event.target.value }))}/></label><label>Participant definition<select aria-label="Participant definition" value={part.participantId ?? ''} aria-invalid={invalidId === part.id} aria-describedby={invalidId === part.id ? `part-error-${part.id}` : undefined} onChange={event => { const definition = definitions.find(item => item.id === Number(event.target.value)); editPart(part.id, { participantId: definition?.id ?? null, participant: definition }); }}><option value="">Choose a saved Participant</option>{[...(part.participant && part.participantId != null && !definitions.some(item => item.id === part.participantId) ? [{ ...part.participant, id: part.participantId }] : []), ...definitions.filter(item => item.id === part.participantId || matches.includes(item))].map(definition => <option key={definition.id} value={definition.id}>{definition.role}{definition.name ? ` — ${definition.honorific ? `${definition.honorific} ` : ''}${definition.name}` : ' — no name yet'}</option>)}</select>{invalidId === part.id && <span className="field-error" id={`part-error-${part.id}`}>Choose a saved Participant for this entry.</span>}</label>{definitionsState === 'ready' && query.trim() && !matches.length && <p>No saved Participants match “{query}”. Try another name or role, clear the search, or add a definition above.</p>}<label>Display reference by<select aria-label="Display reference by" value={part.referenceMode || 'name'} onChange={event => editPart(part.id, { referenceMode: event.target.value as 'name' | 'role' })}><option value="name">Name</option><option value="role">Role</option></select></label></>; })()}
      <label>Part extra info (optional)<textarea aria-label="Part extra info" maxLength={2000} value={part.extraInfo} onChange={event => editPart(part.id, { extraInfo: event.target.value })}/></label>
      <label><input type="checkbox" checked={part.intentionallyNotListed} onChange={event => editPart(part.id, { intentionallyNotListed: event.target.checked })}/> Intentionally not listed</label>
      <button type="button" onClick={() => { setParts(current => current.filter(entry => entry.id !== part.id)); setDirty(true); }}>Remove participant</button>
    </fieldset>)}
    <button type="button" onClick={() => addPart(targetId, targetKind)}>Add participant</button>
    {definitions.length > 0 && <button type="button" onClick={() => { setParts(current => [...current, { ...makePart(targetId, targetKind), kind: 'reference', participantId: definitions[0].id, referenceMode: 'name', participant: definitions[0] }]); setDirty(true); }}>Reuse a saved Participant</button>}
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
    <section className="participant-manager" aria-label="Participant definitions"><h3>Saved Participants</h3><p>Define a person once, then reuse the saved definition by name or role. Similar names remain separate until you choose a definition.</p>
      {definitionsState === 'loading' && <p role="status">{definitionsSlow ? 'Still loading saved Participants… You can keep editing Parts.' : 'Loading saved Participants…'}</p>}
      {(definitionsState === 'error' || definitionsState === 'offline') && <div role="alert"><p>{definitionsState === 'offline' ? 'You are offline. Reconnect to manage saved Participants.' : definitionsError || 'Could not load saved Participants.'}</p><button type="button" onClick={() => void loadDefinitions()}>Try loading Participants again</button></div>}
      {definitionMessage && <p role="status">{definitionMessage}</p>}{definitionFormError && <p role="alert">{definitionFormError}</p>}
      <form onSubmit={event => void saveDefinition(event)}>
        <h4>{editingDefinition ? 'Edit Participant definition' : 'Add a Participant definition'}</h4>
        <label>Role<input aria-label="Definition role" required maxLength={200} value={definitionDraft.role} aria-invalid={definitionFormError.startsWith('Enter a role')} aria-describedby={definitionFormError.startsWith('Enter a role') ? 'participant-role-error' : undefined} onChange={event => { setDefinitionDraft(current => ({ ...current, role: event.target.value })); setDefinitionFormError(''); }}/>{definitionFormError.startsWith('Enter a role') && <span className="field-error" id="participant-role-error">{definitionFormError}</span>}</label>
        <label>Name (optional)<input aria-label="Definition name" maxLength={200} value={definitionDraft.name} onChange={event => setDefinitionDraft(current => ({ ...current, name: event.target.value }))}/></label>
        <label>Honorific (optional)<input aria-label="Honorific" maxLength={200} value={definitionDraft.honorific} onChange={event => setDefinitionDraft(current => ({ ...current, honorific: event.target.value }))}/></label>
        <label>Position (optional)<input aria-label="Position" maxLength={200} value={definitionDraft.position} onChange={event => setDefinitionDraft(current => ({ ...current, position: event.target.value }))}/></label>
        <label>Organization (optional)<input aria-label="Organization" maxLength={200} value={definitionDraft.organization} onChange={event => setDefinitionDraft(current => ({ ...current, organization: event.target.value }))}/></label>
        <label>Participant subtitle (optional)<input aria-label="Participant subtitle" maxLength={200} value={definitionDraft.subtitle} onChange={event => setDefinitionDraft(current => ({ ...current, subtitle: event.target.value }))}/></label>
        {editingDefinition && <div><p>This change will update references in these Programs:</p><ul>{(definitions.find(item => item.id === editingDefinition)?.programs || []).length ? definitions.find(item => item.id === editingDefinition)!.programs.map(program => <li key={program.id}>{program.title} ({program.status})</li>) : <li>No saved Program references yet.</li>}</ul></div>}
        <button type="submit" disabled={definitionBusy}>{definitionBusy ? 'Saving Participant…' : editingDefinition ? 'Save Participant changes' : 'Add saved Participant'}</button>
        {editingDefinition && <button type="button" disabled={definitionBusy} onClick={resetDefinitionForm}>Cancel editing</button>}
        {definitionFormError.startsWith('Your session ended') && <> <a href="/signin" target="_blank" rel="noreferrer">Open sign-in in another tab</a></>}
      </form>
      <label>Search saved Participants<input aria-label="Search saved Participants" value={definitionQuery} onChange={event => setDefinitionQuery(event.target.value)} placeholder="Search by name or role"/></label>
      {definitionsState === 'ready' && !definitions?.length && <p>No saved Participants yet. Add a definition above to reuse it in this Program.</p>}
      {definitionsState === 'ready' && definitions.length > 0 && !definitions.filter(item => `${item.name} ${item.role} ${item.organization}`.toLocaleLowerCase().includes(definitionQuery.trim().toLocaleLowerCase())).length && <p>No saved Participants match “{definitionQuery}”. Try another name or role, clear the search, or add a new definition above.</p>}
      <ul>{(definitions || []).filter(item => `${item.name} ${item.role} ${item.organization}`.toLocaleLowerCase().includes(definitionQuery.trim().toLocaleLowerCase())).map(definition => <li key={definition.id}><strong>{definition.role}</strong>{definition.name && <> — {definition.honorific && `${definition.honorific} `}{definition.name}</>}{(definition.position || definition.organization || definition.subtitle) && <small> {[definition.position, definition.organization, definition.subtitle].filter(Boolean).join(', ')}</small>}<span> {definition.programs.length ? `Used in ${definition.programs.map(program => program.title).join(', ')}` : 'Not used in a saved Program yet.'}</span> <button type="button" onClick={() => beginDefinitionEdit(definition)}>Edit</button> <button type="button" onClick={() => void deleteDefinition(definition)}>Delete</button></li>)}</ul>
    </section>
    {error && <div role="alert"><p>{error}</p>{conflict ? <button type="button" disabled={busy} onClick={() => void reload()}>Reload saved Program</button> : dirty && !invalidId && <button type="button" disabled={busy} onClick={() => void save()}>Try saving Parts again</button>}{error.startsWith('Your session ended') && <> <a href="/signin" target="_blank" rel="noreferrer">Open sign-in in another tab</a></>}</div>}
    {message && <p role="status">{message}</p>}
    {kept && <aside className="kept-header"><h3>Your unsaved Parts</h3><p>This Program changed elsewhere. The saved Parts and Footer roles are shown below. Review them, then reapply your entries if you still want them.</p><pre className="note-text">{keptSummary(kept)}</pre>{!conflict && <button type="button" disabled={busy} onClick={() => { setParts(onTargets(kept.parts)); setFooter(kept.footer); setKept(undefined); setDirty(true); setMessage(''); }}>Reapply my Parts entries</button>}<button type="button" disabled={busy} onClick={() => { setKept(undefined); if (!dirty) clearDraft(); }}>Discard my kept entries</button></aside>}
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
