import { useEffect, useState } from 'react';
import { ProgramRenderer } from '../programs/ProgramRenderer.js';
import type { Program } from '../../../src/domain/programs.js';
import type { ContentNode } from '../../../src/domain/content.js';
import type { ListedPart, FooterRole } from '../../../src/domain/parts.js';
type EventView = { id: number; name: string; startDate: string | null; endDate: string | null; groupByDate: boolean };
type ProgramView = { id: number; title: string; date: string | null; status: 'Published'; url: string };
type ReaderData = { event: EventView; programs: ProgramView[] };
type Listing = { program: Program; nodes: ContentNode[]; parts: ListedPart[]; footer: FooterRole[] };
export function EventReader() {
  const match = /^\/e\/(\d+)(?:\/p\/(\d+))?$/.exec(location.pathname);
  const [, eventId, programId] = match || [];
  const [data, setData] = useState<ReaderData>(); const [error, setError] = useState(''); const [busy, setBusy] = useState(true); const [slow, setSlow] = useState(false);
  const [listing, setListing] = useState<Listing>();
  useEffect(() => {
    if (!eventId) { setError('Event not found.'); setBusy(false); return; }
    let active = true; const timer = setTimeout(() => active && setSlow(true), 1500);
    const endpoint = programId ? `/api/public/events/${eventId}/programs/${programId}` : `/api/public/events/${eventId}`;
    fetch(endpoint).then(async r => { if (!r.ok) throw Error(programId ? 'This Published Program is not available through this Event.' : 'This Event link is unavailable. It may have been removed.'); return r.json(); }).then(value => { if (active) { if (programId) setListing(value); else setData(value); setError(''); } }).catch(reason => { if (active) setError(!navigator.onLine ? 'You are offline. Reconnect, then try again.' : reason instanceof Error ? reason.message : 'Could not load this Event.'); }).finally(() => { clearTimeout(timer); if (active) { setBusy(false); setSlow(false); } });
    return () => { active = false; clearTimeout(timer); };
  }, [eventId, programId]);
  const retry = () => { setBusy(true); setError(''); setData(undefined); window.location.reload(); };
  if (busy && !data) return <main><p role="status">{slow ? 'Still loading this Event… Its Programs will appear as soon as they arrive.' : 'Loading Event…'}</p>{slow && <div className="loading-progress" aria-hidden="true"/>}</main>;
  if (error || (!data && !listing)) return <main><section className="card"><h1>Could not open Event</h1><p>{error || 'This Event link is unavailable.'}</p><button onClick={retry}>Try again</button></section></main>;
  if (programId && listing) return <main className="reader-page"><nav className="reader-actions"><a href={`/e/${eventId}`}>← Event listing</a><button onClick={() => window.print()}>Print</button></nav><ProgramRenderer program={listing.program} nodes={listing.nodes} parts={listing.parts || []} footer={listing.footer || []}/></main>;
  if (!data) return null;
  const programs = [...data.programs];
  const groups = data.event.groupByDate ? programs.reduce((map, item) => { const key = item.date || 'undated'; map.set(key, [...(map.get(key) || []), item]); return map; }, new Map<string, ProgramView[]>()) : new Map([['all', programs]]);
  const orderedGroups = [...groups].sort(([left], [right]) => left === 'undated' ? 1 : right === 'undated' ? -1 : left === 'all' ? 0 : left.localeCompare(right));
  const eventDate = data.event.startDate && data.event.endDate && data.event.startDate !== data.event.endDate ? `${data.event.startDate} – ${data.event.endDate}` : data.event.startDate || data.event.endDate;
  return <main className="reader-page"><nav className="reader-actions"><a href={`/e/${eventId}`}>Program Rundown</a><button onClick={() => window.print()}>Print</button></nav><section className="reader-listing"><header className="reader-header"><h1>{data.event.name}</h1>{eventDate && <p>{eventDate}</p>}<p>Published Programs</p></header>{programs.length === 0 ? <p>No published Programs are available yet.</p> : orderedGroups.map(([date, rows]) => <section className="event-reader-group" key={date}><h2>{date === 'undated' ? 'Undated' : date === 'all' ? 'Programs' : date}</h2><ol>{rows.map(program => <li key={program.id}><a href={`/e/${eventId}/p/${program.id}`}>{program.title}</a>{program.date && <span> · {program.date}</span>}</li>)}</ol></section>)}</section></main>;
}
