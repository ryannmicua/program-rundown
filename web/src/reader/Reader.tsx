import { useEffect, useState } from 'react';
import type { Program } from '../../../src/domain/programs.js';
import type { ContentNode } from '../../../src/domain/content.js';
import { Rundown } from '../editor/Rundown.js';

type Listing = { program: Program; nodes: ContentNode[] };

function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function displayTime(value: string) {
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(new Date(`1970-01-01T${value}:00Z`));
  return time.replace(' AM', ' A.M.').replace(' PM', ' P.M.');
}

export function Reader() {
  const id = /^\/p\/(\d+)$/.exec(window.location.pathname)?.[1];
  const [listing, setListing] = useState<Listing>();
  const [state, setState] = useState<'loading' | 'offline' | 'error' | 'missing'>('loading');
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!id) { setState('missing'); return; }
    let active = true;
    const timer = window.setTimeout(() => { if (active) setSlow(true); }, 1800);
    fetch(`/api/public/programs/${id}`).then(async response => {
      if (response.status === 404) throw new Error('missing');
      if (!response.ok) throw new Error('network');
      return response.json() as Promise<Listing>;
    }).then(data => { if (active) { window.clearTimeout(timer); setSlow(false); setListing(data); setState('loading'); } })
      .catch(error => { if (active) { window.clearTimeout(timer); setSlow(false); setState(error.message === 'missing' ? 'missing' : window.navigator.onLine ? 'error' : 'offline'); } });
    return () => { active = false; window.clearTimeout(timer); };
  }, [id, attempt]);
  function retry() { setState('loading'); setAttempt(count => count + 1); }
  if (state === 'loading' && !listing) return <main><p role="status">{slow ? 'Still loading this Program… Your page will appear as soon as it arrives.' : 'Loading published Program…'}</p>{slow && <div className="loading-progress" aria-hidden="true"/>}</main>;
  if (state === 'offline') return <main><section className="card"><h1>You’re offline</h1><p>Reconnect to read this Program, then try again.</p><button onClick={retry}>Try again</button></section></main>;
  if (state === 'error') return <main><section className="card"><h1>Could not load this Program</h1><p>Check your connection and try again.</p><button onClick={retry}>Try again</button></section></main>;
  if (state === 'missing' || !listing) return <main><section className="card"><h1>Program not found</h1><p>This link may be incorrect, or the Program has not been published.</p></section></main>;
  const { program, nodes } = listing;
  const date = program.date ? displayDate(program.date) : '';
  const time = program.startTime || program.endTime
    ? `${program.startTime ? displayTime(program.startTime) : ''}${program.startTime && program.endTime ? ' – ' : ''}${program.endTime ? displayTime(program.endTime) : ''}`
    : '';
  return <main className="reader-page">
    <nav className="reader-actions" aria-label="Reader actions"><a href={`/p/${program.id}`}>Program Rundown</a><button onClick={() => window.print()}>Print</button></nav>
    <article className="reader-listing">
      <header className="reader-header"><h1>{program.title}</h1>
        {(date || time) && <p className="reader-meta">{date}{date && time && <span className="reader-meta-separator"> | </span>}{time}</p>}
      </header>
      {nodes.length ? <Rundown nodes={nodes} showHeading={false}/> : <p className="reader-empty">No rundown details have been added yet.</p>}
    </article>
  </main>;
}
