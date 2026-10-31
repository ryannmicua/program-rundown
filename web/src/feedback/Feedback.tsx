// Steward's page picker pattern, using public controls and privacy-safe context.
import { useEffect, useState } from 'react';
type ElementContext = { selector: string; tag: string; text: string; box: { x: number; y: number; width: number; height: number } };
type Note = { id: number; note: string; route: string; createdAt: string; reporter: string | null; element: ElementContext | null; done: boolean };
export function cssSelector(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== document.body) {
    const siblings = Array.from(node.parentElement?.children ?? []).filter(s => s.localName === node!.localName);
    parts.unshift(`${node.localName}${siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node) + 1})` : ''}`);
    node = node.parentElement;
  }
  return ['body', ...parts].join(' > ');
}
export function elementContext(el: Element): ElementContext {
  const box = el.getBoundingClientRect();
  // Never read form values or a container's descendants as context.
  const sensitive = el.closest('input, textarea, select, form, [data-private]');
  const leafText = !sensitive && !el.children.length ? el.textContent || '' : '';
  return { selector: cssSelector(el), tag: el.localName, text: leafText.slice(0, 200), box: { x: box.x, y: box.y, width: box.width, height: box.height } };
}
async function request(path: string, method?: string, body?: unknown) {
  const response = await fetch(path, method ? { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  if (!response.ok) throw Error((await response.json()).error || 'Could not save feedback.');
  return response.json();
}
export default function Feedback({ canRead }: { canRead: boolean }) {
  const [mode, setMode] = useState<'idle' | 'pick' | 'write'>('idle');
  const [element, setElement] = useState<ElementContext | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [highlight, setHighlight] = useState<Note>();
  const isList = location.pathname === '/feedback';
  useEffect(() => {
    if (mode !== 'pick') return;
    function target(event: Event) { return event.target instanceof Element && !event.target.closest('[data-feedback-ui]') ? event.target : null; }
    function hold(event: Event) { if (target(event)) { event.preventDefault(); event.stopImmediatePropagation(); } }
    function pick(event: Event) { const el = target(event); if (!el) return; hold(event); setElement(elementContext(el)); setMode('write'); }
    const holds = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'submit', 'keydown'];
    holds.forEach(type => document.addEventListener(type, hold, true));
    document.addEventListener('click', pick, true);
    return () => { holds.forEach(type => document.removeEventListener(type, hold, true)); document.removeEventListener('click', pick, true); };
  }, [mode]);
  useEffect(() => {
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { setMode('idle'); setHighlight(undefined); } }
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, []);
  useEffect(() => {
    if (!canRead) return;
    if (isList) request('/api/feedback').then(data => setNotes(data.feedback)).catch(e => setMessage(e.message));
    const id = /^#feedback=(\d+)$/.exec(location.hash)?.[1];
    if (id) request(`/api/feedback/${id}`).then(data => setHighlight(data.feedback)).catch(e => setMessage(e.message));
  }, [canRead, isList]);
  useEffect(() => {
    if (!highlight?.element) return;
    let el: Element | null = null;
    try { el = document.querySelector(highlight.element.selector); } catch { /* Old selectors remain readable. */ }
    el?.classList.add('feedback-highlight');
    return () => el?.classList.remove('feedback-highlight');
  }, [highlight]);
  return <div data-feedback-ui>
    {isList && canRead && <section className="feedback-list" aria-label="Feedback notes"><h2>Feedback notes</h2>{!notes.length && <p>No notes yet.</p>}{notes.map(item => <article className="card" key={item.id}>
      <p className="eyebrow">#{item.id} · {item.done ? 'Done' : 'Open'} · {item.reporter || 'Anonymous'}</p><p className="note-text">{item.note}</p>
      <p>{item.element?.text}</p><a href={`${item.route}#feedback=${item.id}`}>Open page context</a><button onClick={async () => {
        try { const data = await request(`/api/feedback/${item.id}`, 'PATCH', { done: !item.done }); setNotes(items => items.map(n => n.id === item.id ? data.feedback : n)); } catch (e) { setMessage((e as Error).message); }
      }}>{item.done ? 'Reopen' : 'Mark done'}</button>
    </article>)}</section>}
    {highlight && <aside className="feedback-panel" role="dialog" aria-label="Saved feedback"><h2>Feedback #{highlight.id}</h2><p className="note-text">{highlight.note}</p><p>{highlight.element ? `Selected context: ${highlight.element.text || highlight.element.tag}. The element may no longer be on this page.` : 'About the whole page.'}</p><button onClick={() => setHighlight(undefined)}>Close</button></aside>}
    {mode === 'idle' && <button className="feedback-tab" onClick={() => { setMessage(''); setMode('pick'); }}>Feedback</button>}
    {mode === 'pick' && <aside className="feedback-panel" aria-label="Select feedback context"><p>Click a part of the page to select it.</p><button onClick={() => { setElement(null); setMode('write'); }}>General note</button><button onClick={() => setMode('idle')}>Cancel</button></aside>}
    {mode === 'write' && <form className="feedback-panel" aria-label="Leave feedback" onSubmit={async event => {
      event.preventDefault(); if (!note.trim()) { setMessage('Write a note first.'); return; } setBusy(true); setMessage('');
      try { await request('/api/feedback', 'POST', { note, route: location.pathname, element, viewport: { width: innerWidth, height: innerHeight } }); setNote(''); setMode('idle'); setMessage('Thank you. Your note was sent.'); if (isList && canRead) setNotes((await request('/api/feedback')).feedback); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
    }}><h2>{element ? 'Feedback on this part' : 'Feedback on this page'}</h2>{element?.text && <p>{element.text}</p>}<label htmlFor="feedback-note">Your note</label><textarea id="feedback-note" autoFocus required maxLength={4000} value={note} onChange={e => setNote(e.target.value)} rows={4}/><button disabled={busy} type="submit">{busy ? 'Sending…' : 'Send'}</button><button type="button" onClick={() => setMode('idle')}>Cancel</button></form>}
    {message && <p className="feedback-message" role="status">{message}</p>}
  </div>;
}
