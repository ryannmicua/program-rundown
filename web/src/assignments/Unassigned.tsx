import { useEffect, useMemo, useState } from 'react';
import type { ReviewPart } from '../../../src/domain/unassigned.js';
import { filterReviewParts } from '../../../src/domain/unassigned.js';

type ProgramOption = { id: number; title: string };
export function Unassigned() {
  const [parts, setParts] = useState<ReviewPart[]>();
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [query, setQuery] = useState('');
  const [programId, setProgramId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  async function load() {
    setBusy(true); setError(''); setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 1500);
    try {
      const response = await fetch('/api/unassigned');
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session ended. Sign in again to review assignments.' : response.status === 403 ? 'Coordinator access is required. Sign in with the configured coordinator account.' : data.error || 'Could not load unassigned Parts.');
      setParts(data.parts); setPrograms(data.programs);
    } catch (reason) { setError(!navigator.onLine ? 'You are offline. Reconnect, then try again.' : reason instanceof Error ? reason.message : 'Could not load unassigned Parts.'); }
    finally { window.clearTimeout(timer); setBusy(false); setSlow(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('pageshow', refresh);
    window.addEventListener('focus', refresh);
    return () => { window.removeEventListener('pageshow', refresh); window.removeEventListener('focus', refresh); };
  }, []);
  const filtered = useMemo(() => filterReviewParts(parts || [], query, programId), [parts, query, programId]);
  return <section className="card unassigned-review">
    <div className="program-heading"><div><p className="eyebrow">Coordinator workspace</p><h2>Assignments awaiting a name</h2></div><button type="button" disabled={busy} onClick={() => void load()}>{busy ? 'Refreshing…' : 'Refresh list'}</button></div>
    <p>Review blank and role-only Parts, then open their Program to complete the assignment. Saved changes appear when you return or refresh this list.</p>
    {error && <div role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => void load()}>Try again</button>{error.includes('session ended') && <> <a href="/auth/login" target="_blank" rel="noreferrer">Sign in again</a></>}</div>}
    {!parts && !error && <><p role="status">{slow ? 'Still loading assignments… They will appear as soon as they arrive.' : 'Loading assignments…'}</p>{slow && <div className="loading-progress" aria-hidden="true"/>}</>}
    {parts && <>
      <div className="review-filters">
        <label htmlFor="assignment-search">Search assignments</label>
        <input id="assignment-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search Programs, Items, roles, or notes"/>
        <label htmlFor="assignment-program">Program</label>
        <select id="assignment-program" value={programId ?? ''} onChange={event => setProgramId(event.target.value ? Number(event.target.value) : null)}>
          <option value="">All Programs</option>{programs.map(program => <option key={program.id} value={program.id}>{program.title}</option>)}
        </select>
        {(query || programId != null) && <button type="button" onClick={() => { setQuery(''); setProgramId(null); }}>Clear filters</button>}
      </div>
      {!parts.length && <div className="review-empty"><h3>All assignments have names</h3><p>There are no blank or role-only Parts to review. New Parts will appear here until they receive a name.</p><a className="primary" href="/">Open Programs</a></div>}
      {parts.length > 0 && !filtered.length && <div className="review-empty"><h3>No assignments match these filters</h3><p>Try a different search, choose All Programs, or clear the filters to see every assignment awaiting a name.</p><button type="button" onClick={() => { setQuery(''); setProgramId(null); }}>Clear filters</button></div>}
      {filtered.length > 0 && <ul className="review-list">{filtered.map(part => <li key={`${part.programId}:${part.id}`}>
        <div><a href={`/programs/${part.programId}#part-target-${part.targetKind}-${encodeURIComponent(part.targetId)}`}>{part.targetPath}</a><p>{part.programTitle}{part.eventName ? ` · ${part.eventName}` : ''}</p>
          {part.role && <p><strong>{part.role}</strong>{part.kind === 'reference' && part.participant?.name ? ` · ${part.participant.name}` : ''}</p>}
          {part.kind === 'blank' && <p>Blank participant</p>}{part.extraInfo && <p className="note-text">{part.extraInfo}</p>}
        </div>
        <a className="review-open" href={`/programs/${part.programId}#part-target-${part.targetKind}-${encodeURIComponent(part.targetId)}`}>Open Program editor</a>
      </li>)}</ul>}
    </>}
  </section>;
}
