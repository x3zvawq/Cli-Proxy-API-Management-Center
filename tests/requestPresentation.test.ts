import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import '../src/i18n';
import { RequestEventsDetailsCard } from '../src/components/usage/RequestEventsDetailsCard';
import { normalizeUsageData, collectUsageDetailsWithEndpoint, type ModelPrice } from '../src/utils/usage';
import { filterMonitorUsage, EMPTY_MONITOR_FILTERS } from '../src/utils/monitorAnalytics';
import { estimateRequestCost, formatRequestCost, requestUpstreamTransport } from '../src/utils/requestPresentation';
import { setActiveTierMultipliers } from '../src/utils/tierMultiplier';
import en from '../src/i18n/locales/en.json';
import zh from '../src/i18n/locales/zh-CN.json';
import tw from '../src/i18n/locales/zh-TW.json';
import ru from '../src/i18n/locales/ru.json';

const raw = {
  'sk-fixture-client-000001': {
    'fixture-model': [{
      id: 'fixture-1', timestamp: '2026-09-07T02:00:00Z', source: 'fixture', auth_index: '1',
      executor_type: 'CodexWebsocketsExecutor', provider: 'codex', failed: false,
      service_tier: 'priority', reasoning_effort: 'high', ttft_ms: 300, latency_ms: 2300,
      tokens: { input_tokens: 1000, cached_tokens: 800, cache_creation_tokens: 50,
        output_tokens: 100, reasoning_tokens: 40, total_tokens: 1100 },
    }],
  },
};
const usage = filterMonitorUsage(normalizeUsageData(raw), EMPTY_MONITOR_FILTERS);
const detail = collectUsageDetailsWithEndpoint(usage)[0];
const price: ModelPrice = { input: 2, output: 10, cacheRead: 0.2, cacheCreate: 2.5 };

describe('request presentation', () => {
  test('preserves executor through plugin normalization, global filters and detail collection', () => {
    expect(detail.executor_type).toBe('CodexWebsocketsExecutor');
    expect(requestUpstreamTransport(detail.executor_type)).toBe('WS');
    expect(requestUpstreamTransport('CodexExecutor')).toBe('HTTP');
    expect(requestUpstreamTransport('OtherExecutor')).toBeNull();
    expect(requestUpstreamTransport()).toBeNull();
  });
  test('prices uncached input, read, write and output without double-counting reasoning', () => {
    const prices = { 'fixture-model': price };
    expect(estimateRequestCost(detail, prices)).toBeCloseTo(0.001585, 10);
    expect(estimateRequestCost({ ...detail, provider: 'claude' }, prices)).toBeCloseTo(0.003285, 10);
    expect(estimateRequestCost(detail, {})).toBeNull();
    expect(estimateRequestCost(detail, { 'fixture-model': { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 } })).toBe(0);
  });
  test('applies context pricing and configured Tier exactly like the overview', () => {
    setActiveTierMultipliers([{ model: 'fixture-model', tier: 'priority', multiplier: 2 }]);
    try {
      expect(estimateRequestCost(detail, { 'fixture-model': { ...price, contextTiers: [
        { threshold: 900, input: 4, output: 20, cacheRead: 0.4, cacheCreate: 5 },
      ] } })).toBeCloseTo(0.00634, 10);
    } finally {
      setActiveTierMultipliers([]);
    }
  });
  test('keeps small nonzero costs visible and distinguishes unknown from free', () => {
    expect(formatRequestCost(null)).toBe('--');
    expect(formatRequestCost(0)).toBe('$0.000000');
    expect(formatRequestCost(0.0000001)).toBe('<$0.000001');
    expect(formatRequestCost(0.001585)).toBe('$0.001585');
  });
  test('renders nine columns, grouped metadata/timing, cost and upstream without delete buttons', () => {
    const html = renderToStaticMarkup(createElement(RequestEventsDetailsCard, {
      usage, modelPrices: { 'fixture-model': price }, loading: false,
      geminiKeys: [], claudeConfigs: [], codexConfigs: [], vertexConfigs: [], openaiProviders: [], authFiles: [],
    }));
    expect(html.match(/<th[ >]/g)).toHaveLength(9);
    expect(html).toContain('$0.001585');
    expect(html).toContain('CodexWebsocketsExecutor');
    expect(html).toContain('priority');
    expect(html).toContain('high');
    expect(html).toContain('50.00');
    expect(html).not.toContain('requestEventsDelete');
    expect(html).not.toContain('sk-fixture-client-000001');
  });
  test('all request labels exist in all supported locales', () => {
    for (const language of [en, zh, tw, ru]) {
      for (const key of ['tier_thinking', 'request_cost', 'cost_estimated', 'price_missing',
        'cost_hint', 'timing_column', 'ttft_short', 'generation_short', 'upstream_transport',
        'not_recorded', 'transport_hint'] as const) {
        expect(language.monitor_custom[key].length).toBeGreaterThan(0);
      }
    }
  });
});
