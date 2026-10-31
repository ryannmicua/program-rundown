import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Feedback, { elementContext } from './Feedback.js';
import { App } from '../App.js';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); history.replaceState({}, '', '/'); });
it('does not render feedback when disabled', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: null, feedbackEnabled: false }) }));
  render(<App />);
  await screen.findByRole('link', { name: 'Sign in' });
  expect(screen.queryByRole('button', { name: 'Feedback' })).toBeNull();
});
it('selects a control without invoking it and sends structural context', async () => {
  const clicked = vi.fn();
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) }); vi.stubGlobal('fetch', fetcher);
  render(<><button onClick={clicked}>Selected action</button><Feedback canRead={false}/></>);
  fireEvent.click(screen.getByRole('button', { name: 'Feedback' }));
  fireEvent.click(screen.getByRole('button', { name: 'Selected action' }));
  expect(clicked).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Your note'), { target: { value: 'A useful note' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Leave feedback' }));
  await screen.findByText('Thank you. Your note was sent.');
  const sent = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(sent.element.text).toBe('Selected action'); expect(sent.element.selector).toContain('body >');
  expect(sent).not.toHaveProperty('url');
});
it('never captures input values or form container text', () => {
  const { container } = render(<form><label>Password<input type="password" defaultValue="private-password"/></label></form>);
  expect(elementContext(container.querySelector('input')!).text).toBe('');
  expect(elementContext(container.querySelector('form')!).text).toBe('');
});
it('renders saved markup as text even when the selected element disappeared', async () => {
  history.replaceState({}, '', '/#feedback=1');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ feedback: { id: 1, note: '<script>bad()</script>', element: { selector: 'body > missing', tag: 'button', text: 'Old action' } } }) }));
  const { container } = render(<Feedback canRead/>);
  await waitFor(() => expect(screen.getByText('<script>bad()</script>')).toBeDefined());
  expect(container.querySelector('script')).toBeNull();
  expect(screen.getByText(/may no longer/)).toBeDefined();
});
