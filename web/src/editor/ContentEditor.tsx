import { useEffect, useRef, useState } from 'react';
import { contentLimits, moveSibling, type ContentNode } from '../../../src/domain/content.js';
import type { Program } from '../../../src/domain/programs.js';
import type { DirectPart, FooterRole } from '../../../src/domain/parts.js';
import { ProgramRenderer } from '../programs/ProgramRenderer.js';

export function ContentEditor({ program, initialNodes, parts = [], footer = [], onSaved, onDirtyChange, reload }: {
  program: Program; initialNodes: ContentNode[]; parts?: DirectPart[]; footer?: FooterRole[]; onSaved(program: Program, nodes: ContentNode[]): void; onDirtyChange(dirty: boolean): void; reload(): Promise<void>;
}) {
  const [nodes, setNodes] = useState(initialNodes);
  const [kept, setKept] = useState<ContentNode[]>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const savedNodes = useRef<ContentNode[] | undefined>(undefined);
  useEffect(() => { onDirtyChange(dirty); }, [dirty]);
  useEffect(() => { if (initialNodes === savedNodes.current) { savedNodes.current = undefined; return; } if (dirty) setKept(nodes); setNodes(initialNodes); setConflict(false); setError(''); setMessage(''); setDirty(false); }, [initialNodes]);

  function change(next: ContentNode[]) { setNodes(next); setDirty(true); setMessage(''); }
  function add(kind: ContentNode['kind'], parentId: string | null) {
    change([...nodes, { id: crypto.randomUUID(), parentId, kind, label: '', detail: '', startTime: null, endTime: null, date: null, blockLabel: '' }]);
  }
  function edit(id: string, fields: Partial<ContentNode>) { change(nodes.map(node => node.id === id ? { ...node, ...fields } : node)); }
  function remove(id: string) { const removed = new Set([id]); let changed = true; while (changed) { changed = false; for (const node of nodes) if (node.parentId && removed.has(node.parentId) && !removed.has(node.id)) { removed.add(node.id); changed = true; } } change(nodes.filter(node => !removed.has(node.id))); }
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
      savedNodes.current = data.nodes; onSaved(data.program, data.nodes); onDirtyChange(false); setNodes(data.nodes); setKept(undefined); setDirty(false); setMessage('Rundown saved.');
    } catch { setError(window.navigator.onLine ? 'Could not connect. Your rundown entries are kept. Try again.' : 'You are offline. Your rundown entries are kept. Reconnect, then try again.'); }
    finally { setBusy(false); }
  }
  function displayName(node: ContentNode) {
    return node.label || (node.kind === 'section' ? 'Unheaded Section' : node.kind === 'mini-program' ? 'Untitled mini-program' : 'New Item');
  }
  function controls(node: ContentNode) {
    const siblings = nodes.filter(other => other.parentId === node.parentId);
    const position = siblings.findIndex(other => other.id === node.id);
    const name = displayName(node);
    return <div className="node-actions">
      <button type="button" disabled={position === 0 || busy || conflict} aria-label={`Move ${name} up`} onClick={() => { change(moveSibling(nodes, node.id, -1)); setMessage(`${name} moved up. Save rundown to keep this order.`); }}>↑ Move up</button>
      <button type="button" disabled={position === siblings.length - 1 || busy || conflict} aria-label={`Move ${name} down`} onClick={() => { change(moveSibling(nodes, node.id, 1)); setMessage(`${name} moved down. Save rundown to keep this order.`); }}>↓ Move down</button>
      <button type="button" disabled={busy || conflict} onClick={() => remove(node.id)}>Remove {node.kind === 'section' ? 'Section and its contents' : node.kind === 'mini-program' ? 'mini-program and its contents' : 'Item'}</button>
    </div>;
  }
  function fields(node: ContentNode) {
    return <div className="header-fields">
      <div className="title-field"><label htmlFor={`${node.id}-label`}>{node.kind === 'section' ? 'Section heading (optional)' : node.kind === 'mini-program' ? 'Mini-program title' : 'Item label'}</label>
        <input id={`${node.id}-label`} maxLength={contentLimits.label} required={node.kind !== 'section'} value={node.label} onChange={event => edit(node.id, { label: event.target.value })}/></div>
      {node.kind !== 'item' && <div><label htmlFor={`${node.id}-blockLabel`}>Block label (optional)</label><input id={`${node.id}-blockLabel`} maxLength={contentLimits.blockLabel} value={node.blockLabel || ''} onChange={event => edit(node.id, { blockLabel: event.target.value })}/></div>}
      {node.kind === 'mini-program' && <div><label htmlFor={`${node.id}-date`}>Mini-program date (optional)</label><input id={`${node.id}-date`} type="date" value={node.date || ''} onChange={event => edit(node.id, { date: event.target.value || null })}/></div>}
      {node.kind === 'item' && <div className="title-field"><label htmlFor={`${node.id}-detail`}>Detail (optional)</label><textarea id={`${node.id}-detail`} maxLength={contentLimits.detail} value={node.detail} onChange={event => edit(node.id, { detail: event.target.value })}/></div>}
      {(['startTime', 'endTime'] as const).map(key => <div key={key}><label htmlFor={`${node.id}-${key}`}>{key === 'startTime' ? 'Start time' : 'End time'} (optional)</label><input id={`${node.id}-${key}`} type="time" value={node[key] || ''} onChange={event => edit(node.id, { [key]: event.target.value || null })}/></div>)}
    </div>;
  }
  function renderNode(node: ContentNode, parent?: ContentNode) {
    if (node.kind === 'item') return <li key={node.id}><div className="content-item" role="group" aria-label={`Item: ${displayName(node)}`}><h4>{displayName(node)}</h4>{fields(node)}{controls(node)}</div></li>;
    const children = nodes.filter(child => child.parentId === node.id);
    const number = nodes.filter(other => other.parentId === node.parentId && other.kind === 'section').indexOf(node) + 1;
    const title = node.kind === 'section' ? `Section ${number}${parent ? ` in ${displayName(parent)}` : ''}: ${node.label || 'Unheaded'}` : `Mini-program: ${displayName(node)}`;
    return <li key={node.id}><section className="content-section" aria-label={title}><h3>{displayName(node)}</h3>{fields(node)}{controls(node)}
      <ol className="content-items">{children.map(child => renderNode(child, node))}</ol>
      {node.kind === 'section' && <button type="button" onClick={() => add('item', node.id)}>Add Item</button>}
      <button type="button" onClick={() => add('section', node.id)}>Add Section</button><button type="button" onClick={() => add('mini-program', node.id)}>Add mini-program</button>
    </section></li>;
  }
  const roots = nodes.filter(node => node.parentId === null);
  return <section className="card rundown-editor" aria-label="Rundown editor">
    <h2>Rundown</h2>
    <p>Sections and mini-programs can nest. Sections group Items, even without a heading. Move buttons work with a pointer or keyboard. Save to keep your changes.</p>
    {error && <div role="alert"><p>{error}</p>{error.startsWith('Your session ended') && <a href="/signin" target="_blank" rel="noreferrer">Open sign-in in another tab</a>}{conflict && <button type="button" disabled={busy} onClick={() => void reload()}>Reload saved rundown</button>}</div>}
    {message && <p role="status">{message}</p>}
    {kept && <aside className="kept-header"><h3>Your unsaved rundown</h3><pre className="note-text">{kept.map(node => `${node.kind === 'section' ? 'Section: ' : node.kind === 'mini-program' ? 'Mini-program: ' : 'Item: '}${node.label || '(unheaded)'}${node.date ? `\nDate: ${node.date}` : ''}${node.detail ? `\n${node.detail}` : ''}${node.startTime ? `\nStart: ${node.startTime}` : ''}${node.endTime ? `\nEnd: ${node.endTime}` : ''}`).join('\n\n')}</pre>{!conflict && <button type="button" onClick={() => change(kept)}>Reapply my rundown entries</button>}</aside>}
    <form aria-label="Rundown" onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy || conflict}>
        <legend className="sr-only">Sections and Items</legend>
        {!roots.length && <p>No Sections yet. Add a Section or mini-program to start your rundown.</p>}
        <ol className="content-sections">{roots.map(node => renderNode(node))}</ol>
        <button type="button" onClick={() => add('section', null)}>Add top-level Section</button><button type="button" onClick={() => add('mini-program', null)}>Add top-level mini-program</button>
        <button className="primary save-rundown" type="submit" disabled={!dirty || busy || conflict}>{busy ? 'Saving rundown…' : 'Save rundown'}</button>
        {dirty && <p>Unsaved rundown changes.</p>}
      </fieldset>
    </form>
    <ProgramRenderer program={program} nodes={nodes} parts={parts} footer={footer} showHeading/>
  </section>;
}
