import { resolvePriceForContext } from '@/utils/usage';
import type { Prices, RequestRow, Totals } from './api';
import type { costFields } from './requestColumns';

export function compactMoney(value: number | null | undefined) {
  if (value == null) return '—';
  if (value > 0 && value < 0.01) return '<$0.01';
  const unit = value >= 1e9 ? 1e9 : value >= 1e6 ? 1e6 : value >= 1e3 ? 1e3 : 1;
  return (
    '$' +
    (value / unit).toFixed(2) +
    (unit === 1e9 ? 'B' : unit === 1e6 ? 'M' : unit === 1e3 ? 'K' : '')
  );
}

export function requestTiming(row: Pick<RequestRow, 'ttft_ms' | 'latency_ms' | 'output'>) {
  const generation =
    row.ttft_ms > 0 && row.latency_ms > row.ttft_ms ? (row.latency_ms - row.ttft_ms) / 1000 : null;
  return {
    first: row.ttft_ms > 0 ? row.ttft_ms / 1000 : null,
    generation,
    tps: generation === null ? null : row.output / generation,
  };
}

export function accountRates(
  row?: Pick<Totals, 'requests' | 'failures' | 'context' | 'cache_read'>
) {
  return {
    success: row?.requests ? (row.requests - row.failures) / row.requests : null,
    cache: row?.context ? row.cache_read / row.context : null,
  };
}

// QoL already normalizes input to non-cached tokens; do not subtract cached tokens again.
export function requestCostParts(
  row: Pick<RequestRow, (typeof costFields)[number]>,
  prices: Prices
) {
  const price = prices[row.model];
  if (!price || row.cost === null) return null;
  const rates = resolvePriceForContext(price, row.context);
  const multiplier = price.tierMultipliers?.[row.tier] ?? 1;
  const parts = [
    { key: 'input', tokens: row.input, rate: rates.input },
    { key: 'output', tokens: row.output, rate: rates.output },
    { key: 'cache_read', tokens: row.cache_read, rate: rates.cacheRead },
    { key: 'cache_write', tokens: row.cache_write, rate: rates.cacheCreate },
  ].map((part) => ({ ...part, cost: (part.tokens * part.rate * multiplier) / 1e6 }));
  const total = parts.reduce((sum, part) => sum + part.cost, 0);
  // Another administrator can reprice history while this session holds older rates.
  return {
    parts,
    multiplier,
    matches: Math.abs(total - row.cost) <= Math.max(1e-8, row.cost * 1e-8),
  };
}
