import { describe, expect, test } from 'bun:test';
import {
  buildUsageSnapshotFromDetails,
  normalizeUsageSourceId,
  type UsageDetailWithEndpoint,
} from '../src/utils/usage';
import {
  buildMonitorTrend,
  EMPTY_MONITOR_FILTERS,
  filterMonitorUsage,
  monitorKeyLabel,
  parseMonitorRange,
  summarizeMonitorUsage,
  toLocalDateTime,
} from '../src/utils/monitorAnalytics';

const start = new Date('2026-08-10T08:00:00Z').getTime();
const record = (overrides: Partial<UsageDetailWithEndpoint> = {}): UsageDetailWithEndpoint => ({
  timestamp: new Date(start).toISOString(),
  __timestampMs: start,
  __endpoint: 'sk-fixture-client-a-000001',
  __modelName: 'fixture-model',
  source: 'fixture-account',
  auth_index: '1',
  failed: false,
  tokens: {
    input_tokens: 100,
    output_tokens: 40,
    cached_tokens: 30,
    reasoning_tokens: 10,
    total_tokens: 140,
  },
  ...overrides,
});
const snapshot = (records: UsageDetailWithEndpoint[]) => buildUsageSnapshotFromDetails(records);
const at = (ms: number) => record({ timestamp: new Date(ms).toISOString(), __timestampMs: ms });

describe('monitor analytics', () => {
  test('parses local dates and rejects empty, invalid and reversed ranges', () => {
    expect(parseMonitorRange('', '')).toBeNull();
    expect(parseMonitorRange('bad', '2026-08-10T08:00')).toBeNull();
    expect(parseMonitorRange('2026-08-10T09:00', '2026-08-10T08:00')).toBeNull();
    expect(parseMonitorRange(toLocalDateTime(start), toLocalDateTime(start + 60_000))).toEqual({
      startMs: start,
      endMs: start + 60_000,
    });
  });
  test('start is inclusive and end exclusive; totals follow filtered detail rows', () => {
    const data = snapshot([at(start - 1), at(start), at(start + 999), at(start + 1000)]);
    const filtered = filterMonitorUsage(data, EMPTY_MONITOR_FILTERS, {
      startMs: start,
      endMs: start + 1000,
    });
    expect(filtered.total_requests).toBe(2);
    expect(filtered.total_tokens).toBe(280);
  });
  test('downstream keys are independent of identical upstream accounts', () => {
    const data = snapshot([
      record(),
      record({ __endpoint: 'sk-fixture-client-b-000002', failed: true }),
      record({ __modelName: 'other' }),
    ]);
    const result = filterMonitorUsage(data, {
      apiKey: 'sk-fixture-client-b-000002',
      model: 'fixture-model',
      source: normalizeUsageSourceId('fixture-account'),
      result: 'failure',
    });
    expect(result.total_requests).toBe(1);
    expect(result.failure_count).toBe(1);
    expect(Object.keys(result.apis)).toEqual(['sk-fixture-client-b-000002']);
  });
  test('TTFT ignores missing timing and failed attempts, and does not double count tokens', () => {
    const stats = summarizeMonitorUsage(
      snapshot([
        record({ ttft_ms: 100 }),
        record({ ttft_ms: 300 }),
        record(),
        record({ ttft_ms: 50_000, failed: true }),
      ])
    );
    expect(stats.ttftSamples).toBe(2);
    expect(stats.ttftP50).toBe(100);
    expect(stats.ttftP95).toBe(300);
    expect(stats.input).toBe(400);
    expect(stats.cached).toBe(120);
    expect(stats.failure).toBe(1);
    expect(summarizeMonitorUsage(null).ttftP95).toBeNull();
  });
  test('historical curve uses selected range, includes empty buckets, and conserves totals', () => {
    const trend = buildMonitorTrend(
      snapshot([at(start), at(start + 2 * 3_600_000), at(start + 3 * 3_600_000)]),
      {},
      'hour',
      { startMs: start, endMs: start + 3 * 3_600_000 }
    );
    expect(trend.labels).toHaveLength(3);
    expect(trend.labels.every((label) => label.startsWith('2026-08-10'))).toBe(true);
    expect(trend.requestSeries).toEqual([1, 0, 1]);
    expect(trend.tokenSeries.reduce((a, b) => a + b, 0)).toBe(280);
  });
  test('long ranges coarsen without losing requests; empty all-time range stays empty', () => {
    const endMs = start + 3_600_000 * 5000;
    const trend = buildMonitorTrend(snapshot([at(start), at(endMs - 1)]), {}, 'hour', {
      startMs: start,
      endMs,
    });
    expect(trend.labels.length).toBeLessThanOrEqual(721);
    expect(trend.requestSeries.reduce((a, b) => a + b, 0)).toBe(2);
    expect(buildMonitorTrend(null, {}, 'day').labels).toEqual([]);
  });
  test('masked key labels never contain the full long or short secret', () => {
    expect(monitorKeyLabel('sk-fixture-client-a-000001')).toBe('sk-fix…000001');
    expect(monitorKeyLabel('short')).not.toContain('short');
  });
});
