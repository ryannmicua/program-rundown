import type { ContentNode } from '../../../src/domain/content.js';

function Times({ node }: { node: ContentNode }) {
  return node.startTime || node.endTime ? <p className="content-times">{node.startTime && <>Start {node.startTime}</>}{node.startTime && node.endTime && ' · '}{node.endTime && <>End {node.endTime}</>}</p> : null;
}

export function Rundown({ nodes }: { nodes: ContentNode[] }) {
  return <section className="rundown-preview" aria-label="Rundown preview"><h3>Preview</h3>
    {nodes.filter(node => node.kind === 'section').map(section => <section className="preview-section" key={section.id} aria-label={section.label || 'Unheaded Section'}>
      {section.label && <h4>{section.label}</h4>}<Times node={section}/>
      <ol>{nodes.filter(node => node.parentId === section.id).map(item => <li key={item.id}><strong>{item.label}</strong><Times node={item}/>{item.detail && <p className="note-text">{item.detail}</p>}</li>)}</ol>
    </section>)}
  </section>;
}
