import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { usageApi } from '../src/services/api/usage';
import { useUsageStatsStore } from '../src/stores/useUsageStatsStore';

const range = {
  startMs: Date.parse('2026-08-10T00:00:00Z'),
  endMs: Date.parse('2026-08-11T00:00:00Z'),
};
const response = (id: string) => ({
  'sk-synthetic-client': {
    model: [
      {
        id,
        timestamp: '2026-08-10T01:00:00Z',
        source: 'test',
        failed: false,
        tokens: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
      },
    ],
  },
});

describe('custom date range requests', () => {
  const getUsage = spyOn(usageApi, 'getUsage');
  afterAll(() => getUsage.mockRestore());
  beforeEach(() => {
    useUsageStatsStore.getState().clearUsageStats();
    getUsage.mockReset();
  });
  afterEach(() => {
    useUsageStatsStore.getState().clearUsageStats();
  });

  test('passes exact RFC3339 start/end, including refreshes, and replaces previous data', async () => {
    getUsage.mockResolvedValueOnce(response('a')).mockResolvedValueOnce(response('b'));
    await useUsageStatsStore.getState().loadUsageStats({ dateRange: range });
    await useUsageStatsStore.getState().loadUsageStats({ dateRange: range, force: true });
    expect(getUsage.mock.calls).toEqual([
      [{ start: '2026-08-10T00:00:00.000Z', end: '2026-08-11T00:00:00.000Z' }],
      [{ start: '2026-08-10T00:00:00.000Z', end: '2026-08-11T00:00:00.000Z' }],
    ]);
    expect(useUsageStatsStore.getState().usageDetails.map((d) => d.id)).toEqual(['b']);
  });
  test('invalid ranges never send a request', async () => {
    await expect(
      useUsageStatsStore
        .getState()
        .loadUsageStats({ dateRange: { startMs: range.endMs, endMs: range.startMs } })
    ).rejects.toThrow('Invalid usage date range');
    expect(getUsage).not.toHaveBeenCalled();
  });
  test('an older response cannot overwrite a newer range', async () => {
    let resolveOld!: (value: Record<string, unknown>) => void;
    getUsage
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          })
      )
      .mockResolvedValueOnce(response('new'));
    const old = useUsageStatsStore.getState().loadUsageStats({ dateRange: range });
    await useUsageStatsStore
      .getState()
      .loadUsageStats({ dateRange: { ...range, endMs: range.endMs + 60_000 } });
    resolveOld(response('old'));
    await old;
    expect(useUsageStatsStore.getState().usageDetails.map((d) => d.id)).toEqual(['new']);
  });
  test('clearing the session invalidates a pending custom query', async () => {
    let resolve!: (value: Record<string, unknown>) => void;
    getUsage.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    const pending = useUsageStatsStore.getState().loadUsageStats({ dateRange: range });
    useUsageStatsStore.getState().clearUsageStats();
    resolve(response('old-session'));
    await pending;
    expect(useUsageStatsStore.getState().usage).toBeNull();
  });
});
