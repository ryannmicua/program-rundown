import { useEffect, useState } from 'react';
import type { Program } from '../../../src/domain/programs.js';
import type { ContentNode } from '../../../src/domain/content.js';
import { ProgramRenderer } from '../programs/ProgramRenderer.js';
import type { FooterRole, ListedPart } from '../../../src/domain/parts.js';

type Listing = { program: Program; nodes: ContentNode[]; parts: ListedPart[]; footer: FooterRole[] };

export function Reader() {
  const id = /^\/p\/(\d+)$/.exec(window.location.pathname)?.[1];
  const [listing, setListing] = useState<Listing>();
  const [state, setState] = useState<'loading' | 'offline' | 'error' | 'missing'>('loading');
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!id) { setState('missing'); return; }
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => { if (active) setSlow(true); }, 1800);
    fetch(`/api/public/programs/${id}`, { signal: controller.signal }).then(async response => {
      if (response.status === 404) throw new Error('missing');
      if (!response.ok) throw new Error('network');
      return response.json() as Promise<Listing>;
    }).then(data => { if (active) { window.clearTimeout(timer); setSlow(false); setListing(data); setState('loading'); } })
      .catch(error => { if (active) { window.clearTimeout(timer); setSlow(false); setState(error.message === 'missing' ? 'missing' : window.navigator.onLine ? 'error' : 'offline'); } });
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [id, attempt]);
  function retry() { setState('loading'); setAttempt(count => count + 1); }
  if (state === 'loading' && !listing) return <main><p role="status">{slow ? 'Still loading this Program… Your page will appear as soon as it arrives.' : 'Loading published Program…'}</p>{slow && <div className="loading-progress" aria-hidden="true"/>}</main>;
  if (state === 'offline') return <main><section className="card"><h1>You’re offline</h1><p>Reconnect to read this Program, then try again.</p><button onClick={retry}>Try again</button></section></main>;
  if (state === 'error') return <main><section className="card"><h1>Could not load this Program</h1><p>Check your connection and try again.</p><button onClick={retry}>Try again</button></section></main>;
  if (state === 'missing' || !listing) return <main><section className="card"><h1>Program not found</h1><p>This link may be incorrect, or the Program has not been published.</p></section></main>;
  const { program, nodes } = listing;
  return <main className="reader-page">
    <nav className="reader-actions" aria-label="Reader actions"><a href={`/p/${program.id}`}>Program Rundown</a><button onClick={() => window.print()}>Print</button></nav>
    <ProgramRenderer program={program} nodes={nodes} parts={listing.parts || []} footer={listing.footer || []}/>
  </main>;
}
