import { useEffect, useState, type FormEvent } from 'react';
import type { Header, HeaderErrors, Program } from '../../../src/domain/programs.js';
import type { ContentNode } from '../../../src/domain/content.js';
import { ContentEditor } from '../editor/ContentEditor.js';

const blank: Header = { title: '', date: null, startTime: null, endTime: null };
function HeaderSummary({ header }: { header: Header }) {
  return <dl className="header-summary">
    <div><dt>Date</dt><dd>{header.date || 'No date'}</dd></div>
    <div><dt>Start time</dt><dd>{header.startTime || 'Not set'}</dd></div>
    <div><dt>End time</dt><dd>{header.endTime || 'Not set'}</dd></div>
  </dl>;
}

export function Programs() {
  const path = window.location.pathname;
  const creating = path === '/programs/new';
  const id = /^\/programs\/(\d+)$/.exec(path)?.[1];
  const detail = creating || Boolean(id);
  const [programs, setPrograms] = useState<Program[]>();
  const [saved, setSaved] = useState<Program>();
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [header, setHeader] = useState<Header>(blank);
  const [kept, setKept] = useState<Header>();
  const [errors, setErrors] = useState<HeaderErrors>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [rundownDirty, setRundownDirty] = useState(false);
  const headerDirty = Boolean(saved && (['title', 'date', 'startTime', 'endTime'] as const).some(key => header[key] !== saved[key]));
  const unsaved = headerDirty || rundownDirty;

  async function publish() {
    if (!saved || unsaved) return;
    setPublishing(true); setPublishError('');
    try {
      const response = await fetch(`/api/programs/${saved.id}/publish`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const data = await response.json();
      if (!response.ok) {
        setPublishError(response.status === 401 ? 'Your session ended. Sign in again to publish.'
          : response.status === 403 ? 'This account cannot publish this Program. Sign out and use the configured coordinator account.'
            : data.error || 'Could not publish. Try again.');
        return;
      }
      setSaved(current => current && { ...current, status: 'Published' });
      setMessage('Program published. Anyone with the link can read and print it.');
    } catch { setPublishError('Could not connect. Your Program is unchanged. Try again.'); }
    finally { setPublishing(false); }
  }

  async function load() {
    setBusy(true);
    try {
      const response = await fetch(id ? `/api/programs/${id}` : '/api/programs');
      const data = await response.json();
      if (!response.ok) {
        setError(response.status === 401 ? 'Your session ended. Sign in again to continue.'
          : response.status === 403 ? 'This account cannot manage Programs. Sign out and use the configured coordinator account.'
            : data.error || 'Could not load your Programs. Try again.');
        return;
      }
      if (id) {
        if (headerDirty) setKept({ ...header });
        setSaved(data.program); setHeader(data.program); setNodes(data.nodes || []);
      } else setPrograms(data.programs);
      setError(''); setErrors({}); setConflict(false);
    } catch { setError('Could not connect. Try again.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (!creating) void load(); }, [path]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(''); setErrors({}); setMessage('');
    try {
      const response = await fetch(creating ? '/api/programs' : `/api/programs/${id}`, {
        method: creating ? 'POST' : 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: header.title, date: header.date, startTime: header.startTime, endTime: header.endTime, ...(saved ? { version: saved.version } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(data.errors || {});
        if (response.status === 409) { setConflict(true); setKept({ ...header }); }
        setError(response.status === 401 ? 'Your session ended. Your entries are kept on this page. Sign in again, then review and save them.'
          : response.status === 403 ? 'This account cannot edit this Program. Sign out and use the configured coordinator account.'
            : data.error || 'Could not save. Your entries are kept. Try again.');
        return;
      }
      if (creating) { window.location.assign(`/programs/${data.program.id}`); return; }
      setSaved(data.program); setHeader(data.program); setKept(undefined); setConflict(false); setMessage('Draft saved.');
    } catch { setError('Could not connect. Your entries are kept. Try again.'); }
    finally { setBusy(false); }
  }

  if (!detail) return <section className="card">
    <div className="program-heading"><h2>{programs?.length ? 'Your Programs' : programs ? 'No programs yet' : 'Your Programs'}</h2><a className="primary" href="/programs/new">New Program</a></div>
    {error && <p role="alert">{error} <button onClick={load} disabled={busy}>Try again</button>{error.startsWith('Your session ended') && <> <a href="/signin" target="_blank" rel="noreferrer">Open sign-in in another tab</a></>}</p>}
    {!programs && !error && <p role="status">Loading Programs…</p>}
    {programs?.length === 0 && <p>Create a Draft with a title. You can add a date or either time whenever you’re ready.</p>}
    <ul className="program-list">{programs?.map(program => <li key={program.id}><a href={`/programs/${program.id}`}>{program.title}</a><span className="draft-badge">{program.status}</span><HeaderSummary header={program}/></li>)}</ul>
  </section>;

  return <>
    <a href="/">← Your Programs</a>
    <section className="card program-editor">
      <p className="eyebrow">Standalone Program · {saved?.status || 'Draft'}</p>
      <h2>{creating ? 'New Program' : saved?.title || 'Open Draft'}</h2>
      {saved && <HeaderSummary header={saved}/>}
      {error && <div role="alert"><p>{error}</p>{error.startsWith('Your session ended') && <a href="/signin" target="_blank" rel="noreferrer">Open sign-in in another tab</a>}{!creating && (!saved || conflict) && <button disabled={busy} onClick={load}>{conflict ? 'Reload saved Draft' : 'Try again'}</button>}</div>}
      {message && <p role="status">{message}</p>}
      {publishError && <p role="alert">{publishError} <button type="button" disabled={busy || publishing || unsaved} onClick={() => void publish()}>Try again</button></p>}
      {saved?.status === 'Draft' && <div className="publish-actions"><button type="button" disabled={busy || publishing || unsaved} onClick={() => void publish()}>{publishing ? 'Publishing…' : 'Publish Program'}</button>{unsaved && <p>Save your Header and rundown changes before publishing.</p>}<p>Publishing makes the current Program readable by anyone with its link.</p></div>}
      {saved?.status === 'Published' && <p className="share-link">Reader link: <a href={`/p/${saved.id}`}>{window.location.origin}/p/{saved.id}</a></p>}
      {!creating && !saved && !error && <p role="status">Loading Draft…</p>}
      {kept && <aside className="kept-header"><h3>Your unsaved entries</h3><p>{kept.title}</p><HeaderSummary header={kept}/>{!conflict && <button type="button" onClick={() => { setHeader(kept); setMessage('Review your entries, then save against the latest Draft.'); }}>Reapply my entries</button>}</aside>}
      {(creating || saved) && <form aria-label="Program Header" onSubmit={save}>
        <p>A title is required. Date, start time, and end time are each optional.</p>
        <div className="header-fields">
          {(['title', 'date', 'startTime', 'endTime'] as const).map(key => <div className={key === 'title' ? 'title-field' : ''} key={key}>
            <label htmlFor={`header-${key}`}>{({ title: 'Title', date: 'Date', startTime: 'Start time', endTime: 'End time' })[key]}</label>
            <input id={`header-${key}`} type={key === 'title' ? 'text' : key === 'date' ? 'date' : 'time'} required={key === 'title'} maxLength={key === 'title' ? 200 : undefined} value={header[key] || ''} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `error-${key}` : undefined} onChange={event => setHeader({ ...header, [key]: event.target.value || (key === 'title' ? '' : null) })}/>
            {errors[key] && <p className="field-error" id={`error-${key}`}>{errors[key]}</p>}
          </div>)}
        </div>
        {errors.form && <p>{errors.form}</p>}{errors.version && <p>{errors.version}</p>}
        <button className="primary" type="submit" disabled={busy || publishing || conflict}>{busy ? 'Saving…' : 'Save Draft'}</button>
      </form>}
    </section>
    {saved && <ContentEditor program={saved} initialNodes={nodes} onSaved={setSaved} onDirtyChange={setRundownDirty} reload={load}/>}
  </>;
}
