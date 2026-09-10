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
  context_group: string;
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
export interface ProbeRequest {
  account: string;
  model: string;
  effort: string;
  prompt: string;
}
export interface ProbeResult {
  id: string;
  account: string;
  model: string;
  effort: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  response_model: string;
  text: string;
  error: string;
  category: string;
  http_status: number;
  elapsed_ms: number;
  ttft_ms: number | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    output_tokens_details?: { reasoning_tokens?: number };
  };
}
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
  group_id: string;
  key_label: string;
  client: {
    user_agent?: string;
    originator?: string;
    device_hash?: string;
    device_source?: string;
  };
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
export interface ConversationRecord {
  id: string;
  session: string;
  key_label: string;
  model: string;
  timestamp: string;
  requests: number;
}
export interface ConversationItem {
  id: string;
  field: string;
  value: unknown;
  request_id: string;
  references: number;
  parents: number;
}
export interface ConversationPage {
  items: ConversationItem[];
  total: number;
  requests: number;
  offset: number;
  next_offset: number;
  order_conflict: boolean;
}
export interface ConversationDirectoryItem {
  id: string;
  position: number;
  references: number;
  role: string;
  type: string;
  category: string;
  label: string;
  preview: string;
}
export interface ConversationDirectory {
  items: ConversationDirectoryItem[];
  total: number;
  requests: number;
  order_conflict: boolean;
}
export interface ConversationDetail {
  id: string;
  field: string;
  value: unknown;
}
async function decompressContext(encoded: string, signal: AbortSignal) {
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const text = await new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  ).text();
  signal.throwIfAborted();
  return text;
}
export interface RefreshJob {
  id: string;
  completed: boolean;
  errors: Record<string, string>;
}
export const qolApi = {
  startProbe: (request: ProbeRequest) =>
    apiClient.post<{ id: string; status: string }>(`${prefix}/account-test`, request),
  probe: async (id: string, signal: AbortSignal): Promise<ProbeResult> => {
    const wire = await apiClient.get<{ result_gzip: string }>(`${prefix}/account-test`, {
      params: { id },
      signal,
    });
    return JSON.parse(await decompressContext(wire.result_gzip, signal)) as ProbeResult;
  },
  cancelProbe: (id: string) =>
    apiClient.post(`${prefix}/account-test-cancel`, undefined, { params: { id } }),
  conversationIndex: async (id: string, signal: AbortSignal): Promise<ConversationDirectory> => {
    const wire = await apiClient.get<Omit<ConversationDirectory, 'items'> & { items_gzip: string }>(
      `${prefix}/conversation-index`,
      { params: { id }, signal }
    );
    return {
      ...wire,
      items: JSON.parse(
        await decompressContext(wire.items_gzip, signal)
      ) as ConversationDirectoryItem[],
    };
  },
  conversationItem: async (
    id: string,
    item: string,
    signal: AbortSignal
  ): Promise<ConversationDetail> => {
    const wire = await apiClient.get<{ id: string; field: string; value_gzip: string }>(
      `${prefix}/conversation-item`,
      { params: { id, item }, signal }
    );
    return {
      id: wire.id,
      field: wire.field,
      value: JSON.parse(await decompressContext(wire.value_gzip, signal)) as unknown,
    };
  },
  conversations: (
    params: Partial<Filters> & { page: number; page_size: number },
    signal: AbortSignal
  ) =>
    apiClient.get<{ items: ConversationRecord[]; total: number }>(`${prefix}/conversations`, {
      params,
      signal,
    }),
  conversation: async (
    id: string,
    offset: number,
    signal: AbortSignal
  ): Promise<ConversationPage> => {
    const wire = await apiClient.get<Omit<ConversationPage, 'items'> & { items_gzip: string }>(
      `${prefix}/conversation`,
      { params: { id, offset }, signal }
    );
    return {
      ...wire,
      items: JSON.parse(await decompressContext(wire.items_gzip, signal)) as ConversationItem[],
    };
  },
  contextStatus: (signal: AbortSignal) =>
    apiClient.get<ContextStatus>(`${prefix}/context-settings`, { signal }),
  saveContextSettings: (settings: ContextSettings, signal: AbortSignal) =>
    apiClient.put<ContextStatus>(`${prefix}/context-settings`, settings, { signal }),
  contexts: (
    params: Partial<Pick<Filters, 'start' | 'end' | 'model'>> & {
      page: number;
      page_size: number;
      group_id?: string;
    },
    signal: AbortSignal
  ) => apiClient.get<ContextPage>(`${prefix}/contexts`, { params, signal }),
  contextBody: async (id: string, signal: AbortSignal): Promise<ContextBody> => {
    const wire = await apiClient.get<{ id: string; body_gzip: string; truncated: boolean }>(
      `${prefix}/context`,
      { params: { id }, signal }
    );
    const body = await decompressContext(wire.body_gzip, signal);
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
