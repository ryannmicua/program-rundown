import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Programs } from './Programs.js';
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); history.replaceState({}, '', '/'); });

it('keeps local entries on conflict and lets the coordinator explicitly reload the saved Header', async () => {
  history.replaceState({}, '', '/programs/1');
  const program = { id: 1, title: 'Original Gathering', date: null, startTime: null, endTime: null, status: 'Draft', version: 1 };
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ program }) })
    .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'This Draft changed. Your entries are kept.' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ program: { ...program, title: 'Other saved title', version: 2 } }) });
  vi.stubGlobal('fetch', fetcher);
  render(<Programs />);
  await screen.findByDisplayValue('Original Gathering');
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My unsaved title' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Program Header' }));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('My unsaved title');
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved Draft' }));
  await screen.findByDisplayValue('Other saved title');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ title: 'My unsaved title', version: 1 });
  expect(screen.getByText(/My unsaved title/)).toBeDefined();
});

it('shows field errors without losing a new Header', async () => {
  history.replaceState({}, '', '/programs/new');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Check the Header fields.', errors: { title: 'Enter a title between 1 and 200 characters.' } }) }));
  render(<Programs />);
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  ' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Program Header' }));
  await screen.findByText('Enter a title between 1 and 200 characters.');
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('  ');
});

it('keeps unsaved entries on a failed save of an existing Draft without offering a reload', async () => {
  history.replaceState({}, '', '/programs/1');
  const program = { id: 1, title: 'Original Gathering', date: null, startTime: null, endTime: null, status: 'Draft', version: 1 };
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ program }) })
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ program: { ...program, title: 'My unsaved title', version: 2 } }) });
  vi.stubGlobal('fetch', fetcher);
  render(<Programs />);
  await screen.findByDisplayValue('Original Gathering');
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My unsaved title' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Program Header' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Could not connect. Your entries are kept. Try again.');
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('My unsaved title');
  fireEvent.submit(screen.getByRole('form', { name: 'Program Header' }));
  await screen.findByText('Draft saved.');
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toMatchObject({ title: 'My unsaved title', version: 1 });
});

it('shows loading, empty, and access-denied states for the Program list', async () => {
  history.replaceState({}, '', '/');
  let complete!: (value: { ok: boolean; status?: number; json(): Promise<unknown> }) => void;
  const fetcher = vi.fn(() => new Promise(resolve => { complete = resolve; }));
  vi.stubGlobal('fetch', fetcher);
  const { rerender } = render(<Programs/>);
  expect(screen.getByRole('status').textContent).toContain('Loading Programs');
  complete({ ok: true, json: async () => ({ programs: [] }) });
  await screen.findByText('Create a Draft with a title. You can add a date or either time whenever you’re ready.');
  expect(screen.getByRole('heading', { name: 'No programs yet' })).toBeDefined();
  fetcher.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 403, json: async () => ({ error: 'Dev tester access required.' }) }));
  history.replaceState({}, '', '/unauthorized-list-check');
  rerender(<Programs/>);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('This account cannot manage Programs. Sign out and use the configured coordinator account.'));
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
});

it('shows progress while Program loading is slow and gives an offline retry route', async () => {
  history.replaceState({}, '', '/');
  vi.useFakeTimers();
  let complete!: (value: { ok: boolean; json(): Promise<unknown> }) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { complete = resolve; })));
  render(<Programs/>);
  expect(screen.getByRole('status').textContent).toContain('Loading Programs');
  await act(async () => { await vi.advanceTimersByTimeAsync(1800); });
  expect(screen.getByRole('status').textContent).toContain('Still loading Programs');
  expect(screen.getByText('Still loading Programs… Your saved work will appear as soon as it arrives.')).toBeDefined();
  complete({ ok: true, json: async () => ({ programs: [] }) });
  vi.useRealTimers();
  await screen.findByText(/Create a Draft with a title/);

  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
  history.replaceState({}, '', '/offline-list-check');
  render(<Programs/>);
  expect((await screen.findByRole('alert')).textContent).toContain('You are offline. Reconnect, then try again.');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
});

it('places Program subtitle validation beside its field and keeps the value', async () => {
  history.replaceState({}, '', '/programs/1');
  const program = { id: 1, title: 'Gathering', subtitle: '', date: null, startTime: null, endTime: null, status: 'Draft', version: 1 };
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ program }) })
    .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: 'Check the Header fields.', errors: { subtitle: 'Use a Program subtitle of up to 500 characters, or leave it blank.' } }) }));
  render(<Programs/>);
  await screen.findByDisplayValue('Gathering');
  fireEvent.change(screen.getByLabelText('Subtitle (optional)'), { target: { value: 'A long subtitle' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Program Header' }));
  const subtitle = screen.getByLabelText('Subtitle (optional)');
  expect(await screen.findByText('Use a Program subtitle of up to 500 characters, or leave it blank.')).toBeDefined();
  expect(subtitle.getAttribute('aria-invalid')).toBe('true');
  expect((subtitle as HTMLInputElement).value).toBe('A long subtitle');
});

it('keeps the other form\'s unsaved entries when one form reloads after a conflict', async () => {
  history.replaceState({}, '', '/programs/1');
  const program = { id: 1, title: 'Original Gathering', date: null, startTime: null, endTime: null, status: 'Draft', version: 1 };
  const section = { id: 'opening', parentId: null, kind: 'section', label: 'Opening', detail: '', startTime: null, endTime: null };
  const conflict = { ok: false, status: 409, json: async () => ({ error: 'This Draft changed.' }) };
  const latest = { ok: true, json: async () => ({ program: { ...program, version: 2 }, nodes: [section] }) };
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ program, nodes: [section] }) })
    .mockResolvedValueOnce(conflict).mockResolvedValueOnce(latest)
    .mockResolvedValueOnce(conflict).mockResolvedValueOnce(latest));
  render(<Programs />);
  await screen.findByDisplayValue('Original Gathering');
  fireEvent.change(screen.getByLabelText('Section heading (optional)'), { target: { value: 'Unsaved heading' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Program Header' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reload saved Draft' }));
  await screen.findByRole('button', { name: 'Reapply my rundown entries' });
  expect(screen.getByText(/Section: Unsaved heading/)).toBeDefined();
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unsaved title' } });
  fireEvent.change(screen.getByLabelText('Section heading (optional)'), { target: { value: 'Second heading' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Rundown' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reload saved rundown' }));
  await screen.findByRole('button', { name: 'Reapply my entries' });
  expect(screen.getByText('Unsaved title')).toBeDefined();
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Original Gathering');
});

it('keeps Publish disabled until Header and rundown changes are saved', async () => {
  history.replaceState({}, '', '/programs/1');
  const program = { id: 1, title: 'Original Gathering', date: null, startTime: null, endTime: null, status: 'Draft', version: 1 };
  const section = { id: 'opening', parentId: null, kind: 'section', label: 'Opening', detail: '', startTime: null, endTime: null };
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ program, nodes: [section] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ program: { ...program, title: 'New title', version: 2 } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ program: { ...program, title: 'New title', version: 3 }, nodes: [{ ...section, label: 'Welcome' }] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal('fetch', fetcher);
  render(<Programs />);
  await screen.findByDisplayValue('Original Gathering');
  const publish = () => screen.getByRole('button', { name: 'Publish Program' }) as HTMLButtonElement;
  expect(publish().disabled).toBe(false);
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New title' } });
  fireEvent.change(screen.getByLabelText('Section heading (optional)'), { target: { value: 'Welcome' } });
  expect(publish().disabled).toBe(true);
  expect(screen.getByText('Save your Header, rundown, and Parts and Footer changes before publishing.')).toBeDefined();
  fireEvent.submit(screen.getByRole('form', { name: 'Program Header' }));
  await screen.findByText('Draft saved.');
  expect(publish().disabled).toBe(true);
  fireEvent.submit(screen.getByRole('form', { name: 'Rundown' }));
  await screen.findByText('Rundown saved.');
  expect(publish().disabled).toBe(false);
  expect(screen.queryByText('Save your Header, rundown, and Parts and Footer changes before publishing.')).toBeNull();
  fireEvent.click(publish());
  await screen.findByText('Program published. Anyone with the link can read and print it.');
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toMatchObject({ version: 2 });
});
