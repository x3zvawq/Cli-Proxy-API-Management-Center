import {
  buildUsageSnapshotFromDetails,
  calculateCost,
  collectUsageDetailsWithEndpoint,
  extractFirstByteLatencyMs,
  extractTotalTokens,
  type ModelPrice,
  type UsageDetailWithEndpoint,
} from './usage';

export interface MonitorDateRange {
  startMs: number;
  endMs: number;
}
export interface MonitorFilters {
  apiKey: string;
  model: string;
  source: string;
  result: string;
}
export const EMPTY_MONITOR_FILTERS: MonitorFilters = {
  apiKey: '',
  model: '',
  source: '',
  result: '',
};

export function toLocalDateTime(ms: number): string {
  const date = new Date(ms);
  return new Date(ms - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function parseMonitorRange(start: string, end: string): MonitorDateRange | null {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  return Number.isFinite(startMs) && Number.isFinite(endMs) && startMs < endMs
    ? { startMs, endMs }
    : null;
}

// The plugin's outer map key is the downstream API key, not the upstream credential.
export function filterMonitorUsage(
  usage: unknown,
  filters: MonitorFilters,
  range?: MonitorDateRange
) {
  return buildUsageSnapshotFromDetails(
    collectUsageDetailsWithEndpoint(usage).filter(
      (detail) =>
        (!range || (detail.__timestampMs >= range.startMs && detail.__timestampMs < range.endMs)) &&
        (!filters.apiKey || detail.__endpoint === filters.apiKey) &&
        (!filters.model || detail.__modelName === filters.model) &&
        (!filters.source || detail.source === filters.source) &&
        (!filters.result || detail.failed === (filters.result === 'failure'))
    )
  );
}

export function monitorKeyLabel(key: string): string {
  return key.length > 12 ? `${key.slice(0, 6)}…${key.slice(-6)}` : '••••';
}

function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

export function summarizeMonitorUsage(usage: unknown) {
  const details = collectUsageDetailsWithEndpoint(usage);
  const ttft = details
    .filter((d) => !d.failed)
    .map(extractFirstByteLatencyMs)
    .filter((value): value is number => value !== null && value >= 0);
  const sum = (name: keyof UsageDetailWithEndpoint['tokens']) =>
    details.reduce((total, detail) => total + (detail.tokens[name] ?? 0), 0);
  return {
    input: sum('input_tokens'),
    output: sum('output_tokens'),
    reasoning: sum('reasoning_tokens'),
    cached: sum('cached_tokens'),
    cacheCreation: sum('cache_creation_tokens'),
    ttftP50: percentile(ttft, 0.5),
    ttftP95: percentile(ttft, 0.95),
    ttftSamples: ttft.length,
    success: details.filter((d) => !d.failed).length,
    failure: details.filter((d) => d.failed).length,
  };
}

/** Exact range, local calendar buckets (including DST), never anchored to today's date. */
export function buildMonitorTrend(
  usage: unknown,
  prices: Record<string, ModelPrice>,
  period: 'hour' | 'day',
  range?: MonitorDateRange
) {
  const details = collectUsageDetailsWithEndpoint(usage);
  const times = details.map((d) => d.__timestampMs).filter(Number.isFinite);
  const startMs = range?.startMs ?? times.reduce((a, b) => Math.min(a, b), Infinity);
  const endMs = range?.endMs ?? times.reduce((a, b) => Math.max(a, b + 1), -Infinity);
  const empty = {
    labels: [] as string[],
    requestSeries: [] as number[],
    tokenSeries: [] as number[],
    costSeries: [] as number[],
  };
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) return empty;
  const date = new Date(startMs);
  if (period === 'day') date.setHours(0, 0, 0, 0);
  else date.setMinutes(0, 0, 0);
  const buckets: number[] = [];
  // Coarsen very long ranges without dropping any data or allocating years of hourly points.
  const step = Math.max(
    1,
    Math.ceil((endMs - startMs) / (period === 'hour' ? 3_600_000 : 86_400_000) / 720)
  );
  while (date.getTime() < endMs) {
    buckets.push(date.getTime());
    if (period === 'day') date.setDate(date.getDate() + step);
    else date.setTime(date.getTime() + step * 3_600_000);
  }
  const labels = buckets.map((ms) => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const offset = -d.getTimezoneOffset();
    return period === 'day'
      ? day
      : `${day} ${pad(d.getHours())}:00 (UTC${offset >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)})`;
  });
  const result = {
    labels,
    requestSeries: buckets.map(() => 0),
    tokenSeries: buckets.map(() => 0),
    costSeries: buckets.map(() => 0),
  };
  for (const detail of details) {
    const time = detail.__timestampMs;
    if (time < startMs || time >= endMs || !Number.isFinite(time)) continue;
    let lo = 0,
      hi = buckets.length;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1;
      if (buckets[mid] <= time) lo = mid;
      else hi = mid;
    }
    result.requestSeries[lo] += 1;
    result.tokenSeries[lo] += extractTotalTokens(detail);
    result.costSeries[lo] += calculateCost(detail, prices);
  }
  return result;
}
