import { lazy, Suspense, useEffect, useState } from 'react';
import { Programs } from './programs/Programs.js';
import { Reader } from './reader/Reader.js';
import { Events } from './events/Events.js';
import { EventReader } from './events/EventReader.js';
import { Templates } from './templates/Templates.js';
import { ParticipantList } from './participants/ParticipantList.js';
const Feedback = lazy(() => import('./feedback/Feedback.js'));
type Session = { user: { label: string; coordinator: boolean } | null; feedbackEnabled: boolean };
export function App() {
  if (/^\/(events\/\d+|programs\/\d+)\/participants$/.test(window.location.pathname)) return <WorkspaceApp><ParticipantList/></WorkspaceApp>;
  if (window.location.pathname.startsWith('/e/')) return <EventReader/>;
  if (window.location.pathname.startsWith('/events')) return <WorkspaceApp><Events/></WorkspaceApp>;
  if (window.location.pathname.startsWith('/templates')) return <WorkspaceApp><Templates/></WorkspaceApp>;
  if (window.location.pathname.startsWith('/p/')) return <Reader/>;
  return <WorkspaceApp/>;
}

function WorkspaceApp({ children }: { children?: React.ReactNode }) {
  const [session, setSession] = useState<Session>();
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/session').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(setSession).catch(() => setError('Could not connect. Reload to try again.')); }, []);
  return <>
    <header><a className="brand" href="/">Program Rundown</a><span className="edition">A little order for meaningful gatherings</span>
      {session?.user && <button onClick={async () => {
        const result = await fetch('/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        if (result.ok) window.location.assign('/signin'); else setError('Could not sign out. Please try again.');
      }}>Sign out</button>}
    </header>
    <main>
      <p className="eyebrow">Your gathering, thoughtfully arranged</p>
      <h1>{session?.user ? 'A place for your programs.' : 'Make room for what matters.'}</h1>
      {error && <p role="alert">{error}</p>}
      {!session && !error && <p role="status">Connecting…</p>}
      {session && !session.user && <section className="card"><h2>Welcome to Program Rundown</h2><p>Sign in to open your workspace.</p><a id="sign-in" className="primary" href="/auth/login">Sign in</a></section>}
      {session?.user && <><p className="eyebrow">{session.user.label}</p>{session.user.coordinator ? children || <><Programs/><Events embedded/></> : <section className="card"><h2>Coordinator access is required</h2><p>This account cannot manage Programs. Sign out, then sign in with the configured coordinator account.</p></section>}</>}
      {session?.feedbackEnabled && session.user?.coordinator && <a href="/feedback">View feedback notes →</a>}
    </main>
    <footer>Program Rundown <span>Made for the moments we share.</span></footer>
    {session?.feedbackEnabled && <Suspense fallback={null}><Feedback canRead={Boolean(session.user?.coordinator)} /></Suspense>}
  </>;
}
