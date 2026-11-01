import { useEffect, useState, type FormEvent } from 'react';
import type { ContentNode } from '../../../src/domain/content.js';
import type { DirectPart, FooterRole } from '../../../src/domain/parts.js';
import { ProgramRenderer } from '../programs/ProgramRenderer.js';

type Template = { id: number; name: string };
type EventChoice = { id: number; name: string };
type DraftField = 'title' | 'date' | 'eventId';
export function Templates() {
  const selectedId = /^\/templates\/(\d+)\/use$/.exec(window.location.pathname)?.[1];
  const draftKey = `template-draft-${selectedId || 'new'}`;
  const readDraft = (field: DraftField) => {
    try { return (JSON.parse(window.localStorage.getItem(draftKey) || '{}') as Partial<Record<DraftField, string>>)[field] || ''; }
    catch { return ''; }
  };
  const [templates, setTemplates] = useState<Template[]>();
  const [events, setEvents] = useState<EventChoice[]>([]);
  const [template, setTemplate] = useState<Template>();
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [parts, setParts] = useState<DirectPart[]>([]);
  const [footer, setFooter] = useState<FooterRole[]>([]);
  const [title, setTitle] = useState(() => readDraft('title'));
  const [date, setDate] = useState(() => readDraft('date'));
  const [eventId, setEventId] = useState(() => readDraft('eventId'));
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [slowPreview, setSlowPreview] = useState(false);
  const [slowCreate, setSlowCreate] = useState(false);
  useEffect(() => {
    if (!selectedId) return;
    try { window.localStorage.setItem(draftKey, JSON.stringify({ title, date, eventId })); } catch { /* The current page still retains the form values. */ }
  }, [date, draftKey, eventId, selectedId, title]);
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => alive && setSlow(true), 1800);
    Promise.all([fetch('/api/templates').then(r => r.json().then(d => { if (!r.ok) throw Error(r.status === 401 ? 'Your session ended. Sign in again to view templates.' : r.status === 403 ? 'Coordinator access is required. Sign in with an authorized coordinator account.' : d.error); return d.templates as Template[]; })), fetch('/api/events').then(r => r.json().then(d => { if (!r.ok) throw Error(r.status === 401 ? 'Your session ended. Sign in again to continue.' : r.status === 403 ? 'This account cannot manage Events. Sign in with an authorized coordinator account.' : d.error); return (d.events as { id: number; name: string }[]).map(({ id, name }) => ({ id, name })); }))]).then(([list, evs]) => { if (alive) { setTemplates(list); setEvents(evs); } }).catch(e => { if (alive) setError(window.navigator.onLine ? `${e.message || 'Could not load templates.'} Try again.` : 'You are offline. Reconnect, then try again.'); }).finally(() => { window.clearTimeout(timer); if (alive) setSlow(false); });
    return () => { alive = false; window.clearTimeout(timer); };
  }, [selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    const timer = window.setTimeout(() => alive && setSlowPreview(true), 1800);
    fetch(`/api/templates/${selectedId}`).then(async response => { const data = await response.json(); if (!response.ok) throw Error(response.status === 401 ? 'Your session ended. Sign in again to continue.' : response.status === 403 ? 'Coordinator access is required. Sign in with an authorized coordinator account.' : data.error); return data; }).then(data => { if (alive) { setTemplate(data.template); setNodes(data.nodes); setParts(data.parts); setFooter(data.footer); } }).catch(e => { if (alive) setError(e.message || 'Could not load this template. Try again.'); }).finally(() => { window.clearTimeout(timer); if (alive) setSlowPreview(false); });
    return () => { alive = false; window.clearTimeout(timer); };
  }, [selectedId]);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setErrors({});
    setSlowCreate(false);
    const timer = window.setTimeout(() => setSlowCreate(true), 1800);
    try {
      const response = await fetch(`/api/templates/${selectedId}/programs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, date: date || null, eventId: eventId || null }) });
      const data = await response.json();
      if (!response.ok) { setErrors(data.errors || {}); setError(response.status === 401 ? 'Your session ended. Sign in again; your entries are still on this page.' : response.status === 403 ? 'Coordinator access is required. Sign in with an authorized coordinator account.' : data.error || 'Could not create the Draft. Your entries are kept. Try again.'); return; }
      try { window.localStorage.removeItem(draftKey); } catch { /* The created Draft is safe even if browser storage is unavailable. */ }
      window.location.assign(`/programs/${data.program.id}?created=template`);
    } catch { setError(window.navigator.onLine ? 'Could not connect. Your entries are kept. Try again.' : 'You are offline. Your entries are kept. Reconnect, then try again.'); }
    finally { window.clearTimeout(timer); setBusy(false); setSlowCreate(false); }
  }
  if (selectedId) return <section className="card">
    <a href="/templates">← Your templates</a><h2>{template ? `Preview: ${template.name}` : 'Template preview'}</h2>
    {error && <p role="alert">{error}{(error.startsWith('Your session ended') || error.startsWith('Coordinator access is required') || error.startsWith('This account cannot')) && <> <a href="/signin" target="_blank" rel="noreferrer">Open sign-in in another tab</a></>} <button type="button" onClick={() => window.location.reload()}>Try again</button></p>}
    {!template && !error && <><p role="status">{slowPreview ? 'Still loading the template preview… Your preview will appear as soon as it arrives.' : 'Loading template preview…'}</p>{slowPreview && <div className="loading-progress" aria-hidden="true"/>}</>}
    {template && <><p>This creates a separate Draft. People and Header dates and times are not copied.</p><ProgramRenderer program={{ id: 0, title: title || 'New Program preview', subtitle: '', date: date || null, startTime: null, endTime: null, status: 'Draft', version: 1 }} nodes={nodes} parts={parts} footer={footer}/><form className="template-form" onSubmit={create}>
      <h3>New Draft details</h3>
      <label htmlFor="template-title">Title</label><input id="template-title" required maxLength={200} value={title} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'template-title-error' : undefined} onChange={e => setTitle(e.target.value)}/>{errors.title && <p className="field-error" id="template-title-error">{errors.title}</p>}
      <label htmlFor="template-date">Date (optional)</label><input id="template-date" type="date" value={date} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? 'template-date-error' : undefined} onChange={e => setDate(e.target.value)}/>{errors.date && <p className="field-error" id="template-date-error">{errors.date}</p>}
      <label htmlFor="template-event">Event (optional)</label><select id="template-event" value={eventId} aria-invalid={Boolean(errors.eventId)} aria-describedby={errors.eventId ? 'template-event-error' : undefined} onChange={e => setEventId(e.target.value)}><option value="">Standalone Program</option>{events.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.eventId && <p className="field-error" id="template-event-error">{errors.eventId}</p>}
      <button className="primary" disabled={busy}>{busy ? slowCreate ? 'Still creating Draft…' : 'Creating Draft…' : 'Create Draft'}</button>
      {slowCreate && <><p role="status">This is taking longer than usual. Your entries are saved in this browser; keep this page open.</p><div className="loading-progress" aria-hidden="true"/></>}
    </form></>}
  </section>;
  return <section className="card"><div className="program-heading"><h2>Your templates</h2><a href="/">Your Programs</a></div>
    {error && <p role="alert">{error}{(error.startsWith('Your session ended') || error.startsWith('Coordinator access is required') || error.startsWith('This account cannot')) && <> <a href="/signin" target="_blank" rel="noreferrer">Open sign-in in another tab</a></>} <button type="button" onClick={() => window.location.reload()}>Try again</button></p>}
    {!templates && !error && <><p role="status">{slow ? 'Still loading templates… Your saved templates will appear as soon as they arrive.' : 'Loading templates…'}</p>{slow && <div className="loading-progress" aria-hidden="true"/>}</>}
    {templates?.length === 0 && <p>No templates yet. Open a Program and choose Save as template to create your first one.</p>}
    <ul>{templates?.map(item => <li key={item.id}>{item.name} <a href={`/templates/${item.id}/use`}>Preview and create Draft</a></li>)}</ul>
  </section>;
}
