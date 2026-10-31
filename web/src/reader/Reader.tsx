import { useEffect, useState } from 'react';
import type { Program } from '../../../src/domain/programs.js';
import type { ContentNode } from '../../../src/domain/content.js';
import { Rundown } from '../editor/Rundown.js';

type Listing = { program: Program; nodes: ContentNode[] };

export function Reader() {
  const id = /^\/p\/(\d+)$/.exec(window.location.pathname)?.[1];
  const [listing, setListing] = useState<Listing>();
  const [state, setState] = useState<'loading' | 'error' | 'missing'>('loading');
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!id) { setState('missing'); return; }
    let active = true;
    const timer = window.setTimeout(() => { if (active) setSlow(true); }, 1800);
    fetch(`/api/public/programs/${id}`).then(async response => {
      if (response.status === 404) throw new Error('missing');
      if (!response.ok) throw new Error('network');
      return response.json() as Promise<Listing>;
    }).then(data => { if (active) { window.clearTimeout(timer); setSlow(false); setListing(data); setState('loading'); } })
      .catch(error => { if (active) { window.clearTimeout(timer); setSlow(false); setState(error.message === 'missing' ? 'missing' : 'error'); } });
    return () => { active = false; window.clearTimeout(timer); };
  }, [id]);
  if (state === 'loading' && !listing) return <main><p role="status">{slow ? 'Still loading this Program… Your page will appear as soon as it arrives.' : 'Loading published Program…'}</p>{slow && <div className="loading-progress" aria-hidden="true"/>}</main>;
  if (state === 'error') return <main><section className="card"><h1>Could not load this Program</h1><p>Check your connection and try again.</p><button onClick={() => window.location.reload()}>Try again</button></section></main>;
  if (state === 'missing' || !listing) return <main><section className="card"><h1>Program not found</h1><p>This link may be incorrect, or the Program has not been published.</p></section></main>;
  const { program, nodes } = listing;
  return <main className="reader-page">
    <nav className="reader-actions" aria-label="Reader actions"><a href={`/p/${program.id}`}>Program Rundown</a><button onClick={() => window.print()}>Print</button></nav>
    <article className="reader-listing">
      <header className="reader-header"><h1>{program.title}</h1>
        {(program.date || program.startTime || program.endTime) && <p>{program.date || ''}{program.date && (program.startTime || program.endTime) ? ' · ' : ''}{program.startTime || ''}{program.startTime && program.endTime ? '–' : ''}{program.endTime || ''}</p>}
      </header>
      {nodes.length ? <Rundown nodes={nodes} showHeading={false}/> : <p className="reader-empty">No rundown details have been added yet.</p>}
    </article>
  </main>;
}
