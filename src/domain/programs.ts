import { contentLimits } from './content.js';

export type Header = { title: string; subtitle: string; date: string | null; startTime: string | null; endTime: string | null };
export type Program = Header & { id: number; status: 'Draft' | 'Published'; version: number };
export type HeaderErrors = Partial<Record<keyof Header | 'version' | 'form', string>>;

export function validateHeader(body: unknown, editing: boolean): HeaderErrors {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { form: 'Send a Program Header as an object.' };
  const value = body as Record<string, unknown>;
  const errors: HeaderErrors = {};
  const allowed = ['title', 'subtitle', 'date', 'startTime', 'endTime', ...(editing ? ['version'] : [])];
  if (Object.keys(value).some(key => !allowed.includes(key))) errors.form = 'Only Header fields can be changed.';
  if ((!editing || 'title' in value) && (typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > 200)) errors.title = 'Enter a title between 1 and 200 characters.';
  if (value.date !== undefined && value.date !== null && value.date !== '') {
    if (typeof value.date !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value.date) || Number.isNaN(Date.parse(`${value.date}T00:00:00Z`)) || new Date(`${value.date}T00:00:00Z`).toISOString().slice(0, 10) !== value.date) errors.date = 'Enter a real date as YYYY-MM-DD, or leave it blank.';
  }
  if (value.subtitle !== undefined && (typeof value.subtitle !== 'string' || value.subtitle.length > contentLimits.subtitle)) errors.subtitle = `Use a Program subtitle of up to ${contentLimits.subtitle} characters, or leave it blank.`;
  for (const key of ['startTime', 'endTime'] as const) {
    if (value[key] !== undefined && value[key] !== null && value[key] !== '' && (typeof value[key] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value[key]))) errors[key] = 'Enter a time as HH:MM (00:00–23:59), or leave it blank.';
  }
  if (editing && (!Number.isSafeInteger(value.version) || Number(value.version) < 1)) errors.version = 'Reload the saved Draft before trying again.';
  return errors;
}

export function headerValues(body: Partial<Header>, previous?: Header): Header {
  return {
    title: (body.title ?? previous?.title ?? '').trim(),
    subtitle: (body.subtitle ?? previous?.subtitle ?? '').trim(),
    date: body.date === undefined ? previous?.date ?? null : body.date || null,
    startTime: body.startTime === undefined ? previous?.startTime ?? null : body.startTime || null,
    endTime: body.endTime === undefined ? previous?.endTime ?? null : body.endTime || null,
  };
}
