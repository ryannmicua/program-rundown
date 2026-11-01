import type { Program } from '../../../src/domain/programs.js';
import type { ContentNode } from '../../../src/domain/content.js';
import { displayDate, participant, Rundown } from '../editor/Rundown.js';
import type { FooterRole, ListedPart } from '../../../src/domain/parts.js';

function displayTime(value: string) {
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(new Date(`1970-01-01T${value}:00Z`));
  return time.replace(' AM', ' A.M.').replace(' PM', ' P.M.');
}

export function ProgramRenderer({ program, nodes, parts = [], footer = [], showHeading = false }: { program: Program; nodes: ContentNode[]; parts?: ListedPart[]; footer?: FooterRole[]; showHeading?: boolean }) {
  const date = program.date ? displayDate(program.date) : '';
  const time = program.startTime || program.endTime
    ? `${program.startTime ? displayTime(program.startTime) : ''}${program.startTime && program.endTime ? ' – ' : ''}${program.endTime ? displayTime(program.endTime) : ''}`
    : '';
  return <article className="reader-listing program-renderer">
    <header className="reader-header"><h1>{program.title}</h1>
      {(date || time) && <p className="reader-meta">{date}{date && time && <span className="reader-meta-separator"> | </span>}{time}</p>}
      {program.subtitle && <p className="reader-subtitle">{program.subtitle}</p>}
    </header>
    {nodes.length ? <Rundown nodes={nodes} parts={parts} showHeading={showHeading}/> : <>{showHeading && <Rundown nodes={nodes} parts={parts} showHeading/>}<p className="reader-empty">No rundown details have been added yet.</p></>}
    {footer.length > 0 && <section className="program-footer" aria-label="Footer standing roles"><h2>Standing roles</h2><dl>{footer.map(role => <div key={role.id}><dt>{role.title}</dt>{parts.filter(part => part.targetKind === 'footer' && part.targetId === role.id).map(part => <dd key={part.id}>{participant(part)}{part.extraInfo && <span className="part-extra-info">{part.extraInfo}</span>}</dd>)}</div>)}</dl></section>}
  </article>;
}
