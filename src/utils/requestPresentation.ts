import { calculateCost, type ModelPrice, type UsageDetail } from './usage';

// These concrete executors identify the upstream path, not the downstream
// connection or its stream flag. Keep unrecognized executors explicitly unknown.
export function requestUpstreamTransport(executorType?: string): 'HTTP' | 'WS' | null {
  if (executorType === 'CodexWebsocketsExecutor') return 'WS';
  if (executorType === 'CodexExecutor') return 'HTTP';
  return null;
}

export function estimateRequestCost(detail: UsageDetail, prices: Record<string, ModelPrice>): number | null {
  return prices[detail.__modelName ?? ''] ? calculateCost(detail, prices) : null;
}

export function formatRequestCost(cost: number | null): string {
  if (cost === null) return '--';
  if (cost > 0 && cost < 0.000001) return '<$0.000001';
  return `$${cost.toFixed(6)}`;
}
