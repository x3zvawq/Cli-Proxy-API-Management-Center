import { apiClient } from '@/services/api/client';
import type { ModelPrice } from '@/utils/usage';

export interface Totals {
  requests: number;
  failures: number;
  input: number;
  output: number;
  reasoning: number;
  cache_read: number;
  cache_write: number;
  context: number;
  total: number;
  cost: number;
  priced: number;
  ttft_ms: number | null;
  latency_ms: number | null;
}
export interface Group extends Totals {
  id: string;
  label: string;
}
export interface Summary {
  start: string;
  end: string;
  totals: Totals;
  series: (Totals & { timestamp: string })[];
  keys: Group[];
  models: Group[];
  accounts: Group[];
  groups_truncated: boolean;
}
export interface RequestRow {
  id: string;
  timestamp: string;
  provider: string;
  executor: string;
  model: string;
  key: string;
  key_label: string;
  account: string;
  input: number;
  output: number;
  reasoning: number;
  cache_read: number;
  cache_write: number;
  context: number;
  total: number;
  latency_ms: number;
  ttft_ms: number;
  failed: boolean;
  tier: string;
  thinking: string;
  cost: number | null;
  alias: string | null;
  source: string | null;
  auth_id: string | null;
  auth_type: string | null;
  session_id: string | null;
  parent_session_id: string | null;
  failure_status_code: number | null;
  failure_body: string | null;
  raw_tokens: Record<string, number> | null;
}
export type ProjectedRequest = Pick<RequestRow, 'id'> & Partial<RequestRow>;
export interface RequestPage {
  items: ProjectedRequest[];
  total: number;
  page: number;
  page_size: number;
}
export interface Quota {
  plan: string;
  updated_at: string | null;
  attempt_at: string;
  error?: string;
  proxy: string;
  reset_credits?: number | null;
  applicable_reset_credits?: number | null;
  reset_credits_error?: string;
  windows: {
    name: string;
    used_percent: number;
    seconds: number;
    reset_at: number;
    usage?: Totals & { start: string; end: string; estimated_total: number | null };
  }[];
}
export interface Account {
  id: string;
  auth_index: string;
  name: string;
  provider: string;
  type: string;
  email: string;
  display_name?: string;
  disabled: boolean;
  unavailable: boolean;
  status: string;
  quota?: Quota;
}
export type Prices = Record<string, ModelPrice & { tierMultipliers?: Record<string, number> }>;
export type Filters = {
  start: string;
  end: string;
  key?: string;
  model?: string;
  account?: string;
  result?: string;
};
const prefix = '/plugins/cpa-qol';
export interface ContextSettings {
  enabled: boolean;
  retention_hours: number;
}
export interface ContextStatus extends ContextSettings {
  records: number;
  stored_bytes: number;
  disk_bytes: number;
  limit_bytes: number;
  dropped: number;
  write_errors: number;
}
export interface ContextRecord {
  id: string;
  timestamp: string;
  model: string;
  format: string;
  session: string;
  stream: boolean;
  original_bytes: number;
  stored_bytes: number;
  truncated: boolean;
}
export interface ContextPage {
  items: ContextRecord[];
  total: number;
}
export interface ContextBody {
  id: string;
  body: string;
  truncated: boolean;
}
export interface RefreshJob {
  id: string;
  completed: boolean;
  errors: Record<string, string>;
}
export const qolApi = {
  contextStatus: (signal: AbortSignal) =>
    apiClient.get<ContextStatus>(`${prefix}/context-settings`, { signal }),
  saveContextSettings: (settings: ContextSettings, signal: AbortSignal) =>
    apiClient.put<ContextStatus>(`${prefix}/context-settings`, settings, { signal }),
  contexts: (
    params: Pick<Filters, 'start' | 'end' | 'model'> & { page: number; page_size: number },
    signal: AbortSignal
  ) => apiClient.get<ContextPage>(`${prefix}/contexts`, { params, signal }),
  contextBody: async (id: string, signal: AbortSignal): Promise<ContextBody> => {
    const wire = await apiClient.get<{ id: string; body_gzip: string; truncated: boolean }>(
      `${prefix}/context`,
      { params: { id }, signal }
    );
    const bytes = Uint8Array.from(atob(wire.body_gzip), (c) => c.charCodeAt(0));
    const body = await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).text();
    signal.throwIfAborted();
    return { id: wire.id, body, truncated: wire.truncated };
  },
  summary: (params: Filters, signal: AbortSignal) =>
    apiClient.get<Summary>(`${prefix}/summary`, { params, signal }),
  requests: (
    params: Filters & { page: number; page_size: number; fields?: string },
    signal: AbortSignal
  ) => apiClient.get<RequestPage>(`${prefix}/requests`, { params, signal }),
  accounts: (signal: AbortSignal) => apiClient.get<Account[]>(`${prefix}/accounts`, { signal }),
  prices: (signal: AbortSignal) => apiClient.get<Prices>(`${prefix}/prices`, { signal }),
  savePrices: (prices: Prices) => apiClient.put<Prices>(`${prefix}/prices`, prices),
  models: (signal?: AbortSignal) => apiClient.get<string[]>(`${prefix}/models`, { signal }),
  refreshQuota: (account?: string, signal?: AbortSignal) =>
    apiClient.post<RefreshJob>(`${prefix}/quota-refresh`, undefined, {
      params: { account },
      signal,
    }),
  waitRefresh: (id: string, signal: AbortSignal) =>
    apiClient.get<RefreshJob>(`${prefix}/quota-refresh`, {
      params: { id },
      signal,
      timeout: 25000,
    }),
};

export async function refreshAndWait(account: string | undefined, signal: AbortSignal) {
  let job = await qolApi.refreshQuota(account, signal);
  while (!job.completed) {
    signal.throwIfAborted();
    job = await qolApi.waitRefresh(job.id, signal);
  }
  return job;
}
