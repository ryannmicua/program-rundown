import type { Program } from '../../../src/domain/programs.js';
import type { ContentNode } from '../../../src/domain/content.js';
import { Rundown } from '../editor/Rundown.js';

function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function displayTime(value: string) {
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(new Date(`1970-01-01T${value}:00Z`));
  return time.replace(' AM', ' A.M.').replace(' PM', ' P.M.');
}

export function ProgramRenderer({ program, nodes, showHeading = false }: { program: Program; nodes: ContentNode[]; showHeading?: boolean }) {
  const date = program.date ? displayDate(program.date) : '';
  const time = program.startTime || program.endTime
    ? `${program.startTime ? displayTime(program.startTime) : ''}${program.startTime && program.endTime ? ' – ' : ''}${program.endTime ? displayTime(program.endTime) : ''}`
    : '';
  return <article className="reader-listing program-renderer">
    <header className="reader-header"><h1>{program.title}</h1>
      {(date || time) && <p className="reader-meta">{date}{date && time && <span className="reader-meta-separator"> | </span>}{time}</p>}
      {program.subtitle && <p className="reader-subtitle">{program.subtitle}</p>}
    </header>
    {nodes.length ? <Rundown nodes={nodes} showHeading={showHeading}/> : <>{showHeading && <Rundown nodes={nodes} showHeading/>}<p className="reader-empty">No rundown details have been added yet.</p></>}
  </article>;
}
