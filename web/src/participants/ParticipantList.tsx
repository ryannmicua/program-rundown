import { useEffect, useState } from 'react';
type Assignment = { programId: number; programTitle: string; partId: string; targetLabel: string; targetKind: string; footerTitle?: string; url: string };
type Data = {
  namedParticipants: { participantId: number; role: string; name: string; honorific: string; position: string; organization: string; subtitle: string; assignments: Assignment[] }[];
  textAssignments: { value: string; assignments: Assignment[] }[];
  awaitingName: { participantId?: number; role: string; assignments: Assignment[] }[];
  programs: { id: number; title: string }[];
};
export function ParticipantList() {
  const eventMatch = /^\/events\/(\d+)\/participants$/.exec(location.pathname);
  const programMatch = /^\/programs\/(\d+)\/participants$/.exec(location.pathname);
  const base = eventMatch ? `/api/events/${eventMatch[1]}/participants` : `/api/programs/${programMatch?.[1]}/participants`;
  const [data, setData] = useState<Data>(); const [filter, setFilter] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [slow, setSlow] = useState(false); const [reload, setReload] = useState(0);
  useEffect(() => { let active = true; setLoading(true); setError(''); const timer = window.setTimeout(() => active && setSlow(true), 1500);
    fetch(`${base}${filter ? `?programId=${filter}` : ''}`).then(async response => { const value = await response.json(); if (!response.ok) throw Error(response.status === 401 ? 'Your session ended. Sign in again to view Participants.' : value.error || 'Could not load Participants.'); return value; }).then(value => active && setData(value)).catch(reason => active && setError(!navigator.onLine ? 'You are offline. Reconnect, then try again.' : reason instanceof Error ? reason.message : 'Could not load Participants.')).finally(() => { clearTimeout(timer); if (active) { setLoading(false); setSlow(false); } });
    return () => { active = false; clearTimeout(timer); };
  }, [base, filter, reload]);
  const retry = () => setReload(count => count + 1);
  const groups = data && [...data.namedParticipants.map(item => ({ type: 'named', label: [item.honorific, item.name].filter(Boolean).join(' '), detail: [item.role, [item.position, item.organization].filter(Boolean).join(', '), item.subtitle].filter(Boolean).join(' · '), assignments: item.assignments })), ...data.textAssignments.map(item => ({ type: 'text', label: item.value, detail: 'Text assignment', assignments: item.assignments })), ...data.awaitingName.map(item => ({ type: 'waiting', label: item.role || 'Awaiting a name', detail: item.participantId ? 'Saved Participant definition' : 'Role on this Part', assignments: item.assignments }))];
  const renderGroup = (type: string, heading: string) => { const rows = groups?.filter(item => item.type === type) || []; return <section><h2>{heading}</h2>{!rows.length ? <p>No {heading.toLowerCase()} in this view.</p> : <ul className="participant-list">{rows.map((item, index) => <li key={`${type}-${index}`}><h3>{item.label}</h3><p>{item.detail}</p><ul>{item.assignments.map((assignment, i) => <li key={`${assignment.partId}-${i}`}><a href={assignment.url}>{assignment.programTitle} · {assignment.footerTitle ? `Footer: ${assignment.footerTitle}` : assignment.targetLabel}</a></li>)}</ul></li>)}</ul>}</section>; };
  return <section className="card participant-directory"><p><a href={eventMatch ? `/events/${eventMatch[1]}` : `/programs/${programMatch?.[1]}`}>← Back</a></p><h2>Participants</h2>
    {eventMatch && <label htmlFor="participant-program-filter">Filter by Program <select id="participant-program-filter" value={filter} onChange={event => setFilter(event.target.value)}><option value="">All Event Programs</option>{data?.programs.map(program => <option value={program.id} key={program.id}>{program.title}</option>)}</select></label>}
    {loading && <><p role="status">{slow ? 'Still loading assignments… They will appear as soon as they arrive.' : 'Loading Participants…'}</p>{slow && <div className="loading-progress" aria-hidden="true"/>}</>}
    {error && <p role="alert">{error}{error.includes('session ended') && <> <a href="/auth/login" target="_blank" rel="noreferrer">Sign in again</a></>} <button onClick={retry}>Try again</button></p>}
    {!loading && !error && groups?.length === 0 && (filter ? <p>No assignments in this Program. <button onClick={() => setFilter('')}>Show all Event Programs</button></p> : <p>No Participant assignments yet. Add assignments to Parts to see them here.</p>)}
    {!loading && !error && !!groups?.length && <>{renderGroup('named', 'Named Participants')}{renderGroup('text', 'Text assignments')}{renderGroup('waiting', 'Awaiting a name')}</>}
  </section>;
}
