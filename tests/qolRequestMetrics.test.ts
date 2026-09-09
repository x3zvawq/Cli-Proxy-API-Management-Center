import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compactMoney, requestTiming, requestCostParts, accountRates } from '../src/features/qol/metricFormatting';
import { RequestTiming, RequestTransport, RequestTokens } from '../src/features/qol/RequestMetrics';
import { requestUpstreamTransport } from '../src/utils/requestPresentation';
import type { Prices, RequestRow } from '../src/features/qol/api';

const row = {
  input: 2000, cache_read: 10000, cache_write: 0, context: 12000,
  output: 1000, reasoning: 200, total: 13000, model: 'fixture-model',
  tier: 'priority', cost: 0.032, ttft_ms: 500, latency_ms: 3000,
  executor: 'CodexExecutor',
} as RequestRow;
const prices: Prices = { 'fixture-model': { input: 2, output: 10, cacheRead: 0.2, cacheCreate: 0, tierMultipliers: { priority: 2 } } };

describe('QoL request presentation', () => {
  test('compact money keeps zero, tiny amounts and unknown distinct', () => {
    expect(compactMoney(null)).toBe('—');
    expect(compactMoney(0)).toBe('$0.00');
    expect(compactMoney(0.001)).toBe('<$0.01');
    expect(compactMoney(12345.678)).toBe('$12.35K');
    expect(compactMoney(1234567)).toBe('$1.23M');
  });
  test('uses normalized uncached input and never charges reasoning twice', () => {
    const result = requestCostParts(row, prices)!;
    expect(result.matches).toBe(true);
    expect(result.parts.map(p => p.cost)).toEqual([0.008, 0.02, 0.004, 0]);
    expect(requestCostParts({ ...row, cost: 100 }, prices)?.matches).toBe(false);
    expect(requestCostParts({ ...row, cost: null }, prices)).toBeNull();
    expect(requestCostParts(row, {})).toBeNull();
  });
  test('matches server strict context threshold and zero tier multiplier', () => {
    const tiers: Prices = { 'fixture-model': { ...prices['fixture-model'], contextTiers: [{ threshold: 12000, input: 4, output: 20, cacheRead: 0.4, cacheCreate: 0 }] } };
    expect(requestCostParts(row, tiers)?.matches).toBe(true);
    expect(requestCostParts({ ...row, context: 12001, cost: 0.064 }, tiers)?.matches).toBe(true);
    tiers['fixture-model'].tierMultipliers = { priority: 0 };
    expect(requestCostParts({ ...row, cost: 0 }, tiers)?.matches).toBe(true);
  });
  test('timing is explicit and missing TTFT does not fabricate TPS', () => {
    expect(requestTiming(row)).toEqual({ first: 0.5, generation: 2.5, tps: 400 });
    expect(requestTiming({ ...row, ttft_ms: 0 })).toEqual({ first: null, generation: null, tps: null });
    const html = renderToStaticMarkup(createElement(RequestTiming, { row }));
    expect(html).toContain('0.50s');
    expect(html).toContain('2.50s');
    expect(html.match(/<em>/g)).toHaveLength(3);
    expect(html).toContain('TPS');
  });
  test('account rates are weighted by counts and token volume', () => {
    expect(accountRates({ requests: 20, failures: 2, context: 12000, cache_read: 10000 })).toEqual({ success: 0.9, cache: 10000 / 12000 });
    expect(accountRates()).toEqual({ success: null, cache: null });
  });
  test('preserves known upstream transports without inventing unknown protocols', () => {
    expect(requestUpstreamTransport('CodexExecutor')).toBe('HTTP');
    expect(requestUpstreamTransport('CodexWebsocketsExecutor')).toBe('WS');
    expect(requestUpstreamTransport('OtherExecutor')).toBeNull();
    expect(renderToStaticMarkup(createElement(RequestTransport, { row }))).toContain('HTTP');
  });
  test('restores accessible hover details rather than a blocking token modal', () => {
    const html = renderToStaticMarkup(createElement(RequestTokens, { row }));
    expect(html).toContain('aria-expanded="false"');
    const hover = readFileSync('src/components/ui/HoverDetails.tsx', 'utf8');
    for (const feature of ['onPointerEnter', 'onFocus', 'onClick', 'Escape', 'createPortal']) expect(hover).toContain(feature);
    const page = readFileSync('src/features/qol/QolPage.tsx', 'utf8');
    expect(page).not.toContain('setDetail');
    expect(page).not.toContain('qol.quota_hint');
    expect(page).toContain('qol.request_details');
    const columns = readFileSync('src/features/qol/requestColumns.ts', 'utf8');
    expect(columns.indexOf("id: 'timing'")).toBeLessThan(columns.indexOf("id: 'tier'"));
    for (const file of ['useQuotaRefresh.ts', 'AccountQuota.tsx']) expect(readFileSync('src/features/qol/' + file, 'utf8')).not.toContain('qol.refresh_done');
  });
});
