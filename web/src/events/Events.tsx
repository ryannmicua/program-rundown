import { useEffect, useState, type FormEvent } from 'react';
import type { Program } from '../../../src/domain/programs.js';

type EventRecord = { id: number; name: string; startDate: string | null; endDate: string | null; groupByDate: boolean; programs?: (Program & { eventId?: number; eventPosition: number })[] };
type EditableProgram = Program & { eventId?: number | null; eventPosition?: number };
function requestError(status: number, message: string) {
  if (status === 401) return 'Your session ended. Your entries are still on this page. Sign in again, then retry.';
  if (status === 403) return 'Coordinator access was denied. Sign out, then use the configured coordinator account.';
  return message;
}

export function Events({ embedded = false }: { embedded?: boolean }) {
  const [events, setEvents] = useState<EventRecord[]>();
  const [programs, setPrograms] = useState<EditableProgram[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [editing, setEditing] = useState<EventRecord>();
  const [eventName, setEventName] = useState('');

  async function load() {
    setBusy(true); setError(''); setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 1500);
    try {
      const [eventResponse, programResponse] = await Promise.all([fetch('/api/events'), fetch('/api/programs')]);
      const [eventData, programData] = await Promise.all([eventResponse.json(), programResponse.json()]);
      if (!eventResponse.ok || !programResponse.ok) throw new Error(eventResponse.status === 401 || programResponse.status === 401 ? 'Your session ended. Sign in again to manage Events.' : eventResponse.status === 403 || programResponse.status === 403 ? 'Coordinator access is required. Sign out and use the configured coordinator account.' : eventData.error || programData.error || 'Could not load Events.');
      setEvents(eventData.events); setPrograms(programData.programs);
    } catch (reason) { setError(!navigator.onLine ? 'You are offline. Reconnect, then try again.' : reason instanceof Error ? reason.message : 'Could not load Events. Try again.'); }
    finally { clearTimeout(timer); setBusy(false); setSlow(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const routeId = /^\/events\/(\d+)$/.exec(window.location.pathname)?.[1];
    if (!routeId || !events || editing) return;
    const event = events.find(row => row.id === Number(routeId));
    if (event) void open(event); else setError('Event not found. Try returning to the Event list.');
  }, [events, editing]);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
      const data = await response.json();
      if (!response.ok) { setFieldError(data.errors?.name || ''); setError(data.errors?.name ? '' : requestError(response.status, data.error || 'Could not create Event.')); return; }
      setName(''); setMessage('Event created. Add complete Programs to it next.'); await load();
    } catch { setError(navigator.onLine ? 'Could not connect. Your Event was not created. Try again.' : 'You are offline. Your Event was not created. Reconnect, then try again.'); }
    finally { setBusy(false); }
  }
  async function open(event: EventRecord) {
    setEditing(event); setEventName(event.name); setSelected((event.programs || []).map(program => program.id)); setError(''); setMessage('');
    window.history.pushState({}, '', `/events/${event.id}`);
    try {
      const response = await fetch(`/api/events/${event.id}`); const data = await response.json();
      if (!response.ok) throw new Error(requestError(response.status, data.error || 'Could not open Event.'));
      setEditing(data.event); setEventName(data.event.name); setSelected(data.programs.map((program: Program) => program.id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open Event. Try again.'); }
  }
  async function savePrograms() {
    if (!editing) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/events/${editing.id}/programs`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ programIds: selected }) });
      const data = await response.json();
      if (!response.ok) throw new Error(requestError(response.status, data.error || 'Could not save Event Programs.'));
      setMessage('Program order saved.');
      setEditing(current => current ? { ...current, programs: data.programs } : current);
      setPrograms(current => current.map(program => program.eventId === editing.id || selected.includes(program.id) ? { ...program, eventId: selected.includes(program.id) ? editing.id : null } : program));
    } catch (reason) { setError(!navigator.onLine ? 'You are offline. Your changes are kept here. Reconnect, then save again.' : reason instanceof Error ? reason.message : 'Could not save. Your changes are kept here. Try again.'); }
    finally { setBusy(false); }
  }
  async function updateEvent(changes: Partial<EventRecord>) {
    if (!editing) return;
    const previous = editing;
    setEditing({ ...editing, ...changes });
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/events/${editing.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(changes) });
      const data = await response.json(); if (!response.ok) { setFormErrors(data.errors || {}); throw new Error(requestError(response.status, data.error || 'Could not save Event settings.')); }
      setFormErrors({});
      const event = { ...data.event, groupByDate: Boolean(data.event.groupByDate) };
      setEditing(event);
      setEvents(current => current?.map(row => row.id === event.id ? { ...row, ...event } : row));
      setMessage(changes.groupByDate === undefined ? 'Event settings saved.' : 'Date grouping updated.');
    } catch (reason) { setEditing(previous); setError(!navigator.onLine ? 'You are offline. Reconnect, then try again.' : reason instanceof Error ? reason.message : 'Could not save. Try again.'); }
    finally { setBusy(false); }
  }
  function move(index: number, direction: -1 | 1) { const next = [...selected]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; setSelected(next); }
  const available = programs.filter(program => !program.eventId || program.eventId === editing?.id);
  return <section className="card event-manager">
    <div className="program-heading"><h2>{editing ? editing.name : embedded ? 'Events' : 'Your Events'}</h2>{editing && <button type="button" onClick={() => { window.history.pushState({}, '', embedded ? '/' : '/events'); setEditing(undefined); setError(''); }}>Back to Events</button>}</div>
    {error && <p role="alert">{error}{error.includes('session ended') && <> <a href="/auth/login" target="_blank" rel="noreferrer">Sign in again</a></>}<button type="button" disabled={busy} onClick={() => editing ? void open(editing) : void load()}>Try again</button></p>}
    {message && <p role="status">{message}</p>}
    {!events && !error && <p role="status">{slow ? 'Still loading Events… They will appear as soon as they arrive.' : 'Loading Events…'}</p>}
    {!editing && <>
      {events?.length === 0 && <p>No Events yet. Create one to group complete Programs by day.</p>}
      <ul className="event-list">{events?.map(event => <li key={event.id}><button type="button" className="link-button" onClick={() => void open(event)}>{event.name}</button><a href={`/e/${event.id}`}>Reader link</a><span>{event.programs?.length || 0} Programs</span></li>)}</ul>
      <form onSubmit={create} className="event-create"><label htmlFor="event-name">New Event name</label><input id="event-name" value={name} maxLength={200} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? 'event-name-error' : undefined} onChange={e => { setName(e.target.value); setFieldError(''); }} required/>{fieldError && <p className="field-error" id="event-name-error">{fieldError}</p>}<button className="primary" disabled={busy}>{busy ? 'Creating…' : 'Create Event'}</button></form>
    </>}
    {editing && <>
      <p>Each Program keeps its own Header, date, and publication status. Event dates describe the span; groups use Program dates.</p>
      <form className="event-name-form" onSubmit={event => { event.preventDefault(); void updateEvent({ name: eventName }); }}><label htmlFor="event-name-edit">Event name</label><input id="event-name-edit" value={eventName} maxLength={200} required aria-invalid={Boolean(formErrors.name)} aria-describedby={formErrors.name ? 'event-edit-name-error' : undefined} onChange={event => setEventName(event.target.value)}/>{formErrors.name && <p className="field-error" id="event-edit-name-error">{formErrors.name}</p>}<button type="submit" disabled={busy}>Save Event details</button></form>
      <label className="event-toggle"><input type="checkbox" checked={editing.groupByDate} disabled={busy} onChange={e => void updateEvent({ groupByDate: e.target.checked })}/> Group Programs by their dates</label>
      <div className="header-fields event-dates">{(['startDate', 'endDate'] as const).map(key => <div key={key}><label htmlFor={`event-${key}`}>{key === 'startDate' ? 'Event starts' : 'Event ends'}</label><input id={`event-${key}`} type="date" value={editing[key] || ''} disabled={busy} aria-invalid={Boolean(formErrors[key])} aria-describedby={formErrors[key] ? `event-${key}-error` : undefined} onChange={e => void updateEvent({ [key]: e.target.value || null })}/>{formErrors[key] && <p className="field-error" id={`event-${key}-error`}>{formErrors[key]}</p>}</div>)}</div>
      <h3>Programs in order</h3>
      {selected.length === 0 && <p>No Programs linked yet. Select saved Programs below.</p>}
      <ol className="event-program-order">{selected.map((programId, index) => { const program = programs.find(row => row.id === programId); return <li key={programId}><span>{program?.title || `Program ${programId}`} · {program?.date || 'Undated'} · {program?.status}</span><button type="button" disabled={busy || index === 0} aria-label={`Move ${program?.title} up`} onClick={() => move(index, -1)}>Move up</button><button type="button" disabled={busy || index === selected.length - 1} aria-label={`Move ${program?.title} down`} onClick={() => move(index, 1)}>Move down</button><button type="button" disabled={busy} onClick={() => setSelected(selected.filter(id => id !== programId))}>Unlink</button><a href={`/programs/${programId}`}>Open</a></li>; })}</ol>
      <fieldset><legend>Add or remove Programs</legend>{available.map(program => <label className="event-program-option" key={program.id}><input type="checkbox" checked={selected.includes(program.id)} onChange={e => setSelected(e.target.checked ? [...selected, program.id] : selected.filter(id => id !== program.id))}/>{program.title} · {program.date || 'Undated'} · {program.status}</label>)}</fieldset>
      <button className="primary" disabled={busy} onClick={() => void savePrograms()}>{busy ? 'Saving…' : 'Save Program order and links'}</button>
      <p><a href={`/e/${editing.id}`}>Open anonymous Event reader</a></p>
    </>}
  </section>;
}
