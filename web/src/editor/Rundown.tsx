import type { ContentNode } from '../../../src/domain/content.js';

export function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function Times({ node }: { node: ContentNode }) {
  return node.startTime || node.endTime ? <p className="content-times">{node.startTime && <>Start {node.startTime}</>}{node.startTime && node.endTime && ' · '}{node.endTime && <>End {node.endTime}</>}</p> : null;
}

function Block({ node, nodes }: { node: ContentNode; nodes: ContentNode[] }) {
  const children = nodes.filter(child => child.parentId === node.id);
  const name = node.kind === 'mini-program' ? 'mini-program' : 'Section';
  return <section className={`preview-section preview-${node.kind}`} aria-label={node.kind === 'section' && !node.label ? 'Unheaded Section' : `${name}: ${node.label}`} data-block-label={node.blockLabel || undefined}>
    {node.label && <h4>{node.label}</h4>}{node.kind === 'mini-program' && node.date && <p className="mini-program-date">{displayDate(node.date)}</p>}<Times node={node}/>
    <ol>{children.map(child => child.kind === 'item'
      ? <li key={child.id}><strong>{child.label}</strong><Times node={child}/>{child.detail && <p className="note-text">{child.detail}</p>}</li>
      : <li key={child.id}><Block node={child} nodes={nodes}/></li>)}</ol>
  </section>;
}

export function Rundown({ nodes, showHeading = true }: { nodes: ContentNode[]; showHeading?: boolean }) {
  return <section className="rundown-preview" aria-label={showHeading ? 'Rundown preview' : 'Program rundown'}>{showHeading && <h3>Preview</h3>}
    {nodes.filter(node => node.parentId === null).map(node => <Block node={node} nodes={nodes} key={node.id}/>)}
  </section>;
}
