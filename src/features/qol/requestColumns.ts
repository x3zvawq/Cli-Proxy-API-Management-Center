import type { ProjectedRequest, RequestRow } from './api';

export const tokenFields = [
  'input',
  'output',
  'reasoning',
  'cache_read',
  'cache_write',
  'context',
  'total',
] as const;
export const costFields = [
  'model',
  'cost',
  'tier',
  'input',
  'output',
  'cache_read',
  'cache_write',
  'context',
] as const;
export const timingFields = ['ttft_ms', 'latency_ms', 'output'] as const;
export const requestColumns = [
  { id: 'time', fields: ['timestamp'], default: true },
  { id: 'model', fields: ['model', 'executor'], default: true },
  { id: 'key', fields: ['key', 'key_label'], default: true },
  { id: 'tokens', fields: tokenFields, default: true },
  { id: 'cost', fields: costFields, default: true },
  { id: 'timing', fields: timingFields, default: true },
  { id: 'tier', fields: ['tier'], default: true },
  { id: 'thinking', fields: ['thinking'], default: true },
  { id: 'accounts', fields: ['account'], default: true },
  { id: 'result', fields: ['failed'], default: true },
  { id: 'request_id', fields: ['id'], default: false },
  { id: 'provider', fields: ['provider'], default: false },
  { id: 'executor', fields: ['executor'], default: false },
  { id: 'alias', fields: ['alias'], default: false },
  { id: 'source', fields: ['source'], default: false },
  { id: 'auth_id', fields: ['auth_id'], default: false },
  { id: 'auth_type', fields: ['auth_type'], default: false },
  { id: 'session_id', fields: ['session_id'], default: false },
  { id: 'parent_session_id', fields: ['parent_session_id'], default: false },
  { id: 'failure_status_code', fields: ['failure_status_code'], default: false },
  { id: 'failure_body', fields: ['failure_body'], default: false },
  { id: 'raw_tokens', fields: ['raw_tokens'], default: false },
] as const satisfies readonly {
  id: string;
  fields: readonly (keyof RequestRow)[];
  default: boolean;
}[];
export type RequestColumn = (typeof requestColumns)[number]['id'];
export const defaultColumns = requestColumns.filter((c) => c.default).map((c) => c.id);
export function selectedColumns(selected: string[]) {
  return requestColumns.filter((c) => selected.includes(c.id));
}
export function selectedFields(selected: string[]) {
  return [...new Set(['id', ...selectedColumns(selected).flatMap((c) => [...c.fields])])].join(',');
}
export function pickFields<K extends keyof RequestRow>(
  row: ProjectedRequest,
  fields: readonly K[]
): Pick<RequestRow, K> | null {
  if (fields.some((field) => row[field] === undefined)) return null;
  return Object.fromEntries(fields.map((field) => [field, row[field]])) as Pick<RequestRow, K>;
}
