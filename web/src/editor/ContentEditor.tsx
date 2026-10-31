import { useEffect, useState } from 'react';
import { contentLimits, moveSibling, type ContentNode } from '../../../src/domain/content.js';
import type { Program } from '../../../src/domain/programs.js';
import { Rundown } from './Rundown.js';

export function ContentEditor({ program, initialNodes, onSaved, reload }: {
  program: Program; initialNodes: ContentNode[]; onSaved(program: Program): void; reload(): Promise<void>;
}) {
  const [nodes, setNodes] = useState(initialNodes);
  const [kept, setKept] = useState<ContentNode[]>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (dirty) setKept(nodes); setNodes(initialNodes); setConflict(false); setError(''); setMessage(''); setDirty(false); }, [initialNodes]);

  function change(next: ContentNode[]) { setNodes(next); setDirty(true); setMessage(''); }
  function add(kind: ContentNode['kind'], parentId: string | null) {
    change([...nodes, { id: crypto.randomUUID(), parentId, kind, label: '', detail: '', startTime: null, endTime: null }]);
  }
  function edit(id: string, fields: Partial<ContentNode>) { change(nodes.map(node => node.id === id ? { ...node, ...fields } : node)); }
  function remove(id: string) { change(nodes.filter(node => node.id !== id && node.parentId !== id)); }
  async function save() {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/programs/${program.id}/content`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: program.version, nodes }) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) { setConflict(true); setKept(nodes); }
        setError(response.status === 401 ? 'Your session ended. Your rundown entries are kept on this page. Sign in again, then review and save them.'
          : response.status === 403 ? 'This account cannot edit this Program. Sign out and use the configured coordinator account.'
            : data.error || 'Could not save. Your rundown entries are kept.');
        return;
      }
      onSaved(data.program); setNodes(data.nodes); setKept(undefined); setDirty(false); setMessage('Rundown saved.');
    } catch { setError('Could not connect. Your rundown entries are kept. Try again.'); }
    finally { setBusy(false); }
  }
  function controls(node: ContentNode) {
    const siblings = nodes.filter(other => other.parentId === node.parentId);
    const position = siblings.findIndex(other => other.id === node.id);
    const name = node.label || 'unheaded Section';
    return <div className="node-actions">
      <button type="button" disabled={position === 0 || busy || conflict} aria-label={`Move ${name} up`} onClick={() => { change(moveSibling(nodes, node.id, -1)); setMessage(`${name} moved up. Save rundown to keep this order.`); }}>↑ Move up</button>
      <button type="button" disabled={position === siblings.length - 1 || busy || conflict} aria-label={`Move ${name} down`} onClick={() => { change(moveSibling(nodes, node.id, 1)); setMessage(`${name} moved down. Save rundown to keep this order.`); }}>↓ Move down</button>
      <button type="button" disabled={busy || conflict} onClick={() => remove(node.id)}>Remove {node.kind === 'section' ? 'Section and its Items' : 'Item'}</button>
    </div>;
  }
  function fields(node: ContentNode) {
    return <div className="header-fields">
      <div className="title-field"><label htmlFor={`${node.id}-label`}>{node.kind === 'section' ? 'Section heading (optional)' : 'Item label'}</label>
        <input id={`${node.id}-label`} maxLength={contentLimits.label} required={node.kind === 'item'} value={node.label} onChange={event => edit(node.id, { label: event.target.value })}/></div>
      {node.kind === 'item' && <div className="title-field"><label htmlFor={`${node.id}-detail`}>Detail (optional)</label><textarea id={`${node.id}-detail`} maxLength={contentLimits.detail} value={node.detail} onChange={event => edit(node.id, { detail: event.target.value })}/></div>}
      {(['startTime', 'endTime'] as const).map(key => <div key={key}><label htmlFor={`${node.id}-${key}`}>{key === 'startTime' ? 'Start time' : 'End time'} (optional)</label><input id={`${node.id}-${key}`} type="time" value={node[key] || ''} onChange={event => edit(node.id, { [key]: event.target.value || null })}/></div>)}
    </div>;
  }
  const sections = nodes.filter(node => node.kind === 'section');
  return <section className="card rundown-editor" aria-label="Rundown editor">
    <h2>Rundown</h2>
    <p>Sections group Items, even without a heading. Move buttons work with a pointer or keyboard. Save to keep your changes.</p>
    {error && <div role="alert"><p>{error}</p>{error.startsWith('Your session ended') && <a href="/signin" target="_blank" rel="noreferrer">Open sign-in in another tab</a>}{conflict && <button type="button" disabled={busy} onClick={() => void reload()}>Reload saved rundown</button>}</div>}
    {message && <p role="status">{message}</p>}
    {kept && <aside className="kept-header"><h3>Your unsaved rundown</h3><pre className="note-text">{kept.map(node => `${node.kind === 'section' ? 'Section: ' : 'Item: '}${node.label || '(unheaded)'}${node.detail ? `\n${node.detail}` : ''}${node.startTime ? `\nStart: ${node.startTime}` : ''}${node.endTime ? `\nEnd: ${node.endTime}` : ''}`).join('\n\n')}</pre>{!conflict && <button type="button" onClick={() => change(kept)}>Reapply my rundown entries</button>}</aside>}
    <form aria-label="Rundown" onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy || conflict}>
        <legend className="sr-only">Sections and Items</legend>
        {!sections.length && <p>No Sections yet. Add a Section to start your rundown.</p>}
        <ol className="content-sections">{sections.map((section, index) => <li key={section.id}>
          <section className="content-section" aria-label={`Section ${index + 1}: ${section.label || 'Unheaded'}`}>
            <h3>{section.label || 'Unheaded Section'}</h3>
            {fields(section)}{controls(section)}
            <ol className="content-items">{nodes.filter(node => node.parentId === section.id).map(item => <li key={item.id}><div className="content-item" role="group" aria-label={`Item: ${item.label || 'New Item'}`}><h4>{item.label || 'New Item'}</h4>{fields(item)}{controls(item)}</div></li>)}</ol>
            <button type="button" onClick={() => add('item', section.id)}>Add Item</button>
          </section>
        </li>)}</ol>
        <button type="button" onClick={() => add('section', null)}>Add Section</button>
        <button className="primary save-rundown" type="submit" disabled={!dirty || busy || conflict}>{busy ? 'Saving rundown…' : 'Save rundown'}</button>
        {dirty && <p>Unsaved rundown changes.</p>}
      </fieldset>
    </form>
    <Rundown nodes={nodes}/>
  </section>;
}
