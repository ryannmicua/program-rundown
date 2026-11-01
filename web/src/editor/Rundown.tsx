import type { ContentNode } from '../../../src/domain/content.js';
import type { ListedPart } from '../../../src/domain/parts.js';

export function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function Times({ node }: { node: ContentNode }) {
  return node.startTime || node.endTime ? <p className="content-times">{node.startTime && <>Start {node.startTime}</>}{node.startTime && node.endTime && ' · '}{node.endTime && <>End {node.endTime}</>}</p> : null;
}

export function participant(part: ListedPart) { return part.kind === 'text' ? part.value : part.kind === 'role' ? part.role : part.kind === 'structured' ? part.name.trim() || part.role : ''; }
function PartLines({ node, parts }: { node: ContentNode; parts: ListedPart[] }) {
  return <>{parts.filter(part => part.targetId === node.id && part.targetKind === node.kind).map(part => <div className="part-line" key={part.id}>{participant(part) && <p className="part-participant">{participant(part)}</p>}{part.extraInfo && <p className="part-extra-info">{part.extraInfo}</p>}</div>)}</>;
}
function Block({ node, nodes, parts }: { node: ContentNode; nodes: ContentNode[]; parts: ListedPart[] }) {
  const children = nodes.filter(child => child.parentId === node.id);
  const name = node.kind === 'mini-program' ? 'mini-program' : 'Section';
  return <section className={`preview-section preview-${node.kind}`} aria-label={node.kind === 'section' && !node.label ? 'Unheaded Section' : `${name}: ${node.label}`} data-block-label={node.blockLabel || undefined}>
    {node.label && <h4>{node.label}</h4>}{node.kind === 'mini-program' && node.date && <p className="mini-program-date">{displayDate(node.date)}</p>}<Times node={node}/>
    <PartLines node={node} parts={parts}/>
    <ol>{children.map(child => child.kind === 'item'
      ? <li key={child.id}><strong>{child.label}</strong><Times node={child}/><PartLines node={child} parts={parts}/>{child.detail && <p className="note-text">{child.detail}</p>}</li>
      : <li key={child.id}><Block node={child} nodes={nodes} parts={parts}/></li>)}</ol>
  </section>;
}

export function Rundown({ nodes, parts = [], showHeading = true }: { nodes: ContentNode[]; parts?: ListedPart[]; showHeading?: boolean }) {
  return <section className="rundown-preview" aria-label={showHeading ? 'Rundown preview' : 'Program rundown'}>{showHeading && <h3>Preview</h3>}
    {nodes.filter(node => node.parentId === null).map(node => <Block node={node} nodes={nodes} parts={parts} key={node.id}/>)}
  </section>;
}
