import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  keyPrefixes,
  quotaOptions,
  quotaWindowId,
  readHiddenQuotas,
  quotaDuration,
  quotaLabel,
  relativeTimeRange,
  canResetQuota,
} from '../src/features/qol/display';
import type { Account, Quota } from '../src/features/qol/api';

describe('CPA QoL contracts', () => {
  test('quota periods are compact and quota pools remain distinguishable', () => {
    expect(quotaDuration(604800)).toBe('7d');
    expect(quotaDuration(18000)).toBe('5h');
    expect(
      quotaLabel({ name: 'GPT-5.3-Codex-Spark', seconds: 604800, reset_at: 0, used_percent: 1 })
    ).toBe('spark-7d');
  });
  test('quick ranges retain their duration on refresh', () => {
    for (const days of [1, 7, 30]) {
      const range = relativeTimeRange(days, Date.parse('2026-09-09T00:00:00Z'));
      expect(Date.parse(range.end) - Date.parse(range.start)).toBe(days * 86400000);
    }
  });
  test('reset credits require both a known available and applicable count', () => {
    expect(canResetQuota(undefined)).toBe(false);
    expect(canResetQuota({ reset_credits: 3, applicable_reset_credits: 0 } as Quota)).toBe(false);
    expect(canResetQuota({ reset_credits: 3 } as Quota)).toBe(false);
    expect(canResetQuota({ reset_credits: 3, applicable_reset_credits: 1 } as Quota)).toBe(true);
    expect(
      canResetQuota({ reset_credits: 3, applicable_reset_credits: 1, error: 'HTTP 401' } as Quota)
    ).toBe(false);
  });
  test('native sidebar routes render independent pages', () => {
    const routes = readFileSync(resolve('src/router/MainRoutes.tsx'), 'utf8');
    for (const [path, view] of [
      ['/monitor', 'monitor'],
      ['/quota', 'accounts'],
      ['/model-prices', 'prices'],
    ])
      expect(routes).toContain(`path: '${path}', element: <UsagePage view="${view}"`);
    const page = readFileSync(resolve('src/features/qol/QolPage.tsx'), 'utf8');
    expect(page).not.toContain('styles.tabs');
    expect(page).not.toContain('<h1>CPA QoL');
  });
  test('key labels match stored SHA-256 and expose only the first six characters', async () => {
    const raw = 'sk-abcdef-private-secret';
    const result = await keyPrefixes([raw]);
    const id = new Bun.CryptoHasher('sha256').update(raw).digest('hex');
    expect(result[id]).toBe('sk-abc…');
    expect(JSON.stringify(result)).not.toContain('private-secret');
  });
  test('quota choices merge by name and duration, independent of reset time', () => {
    const first = { name: 'Codex', seconds: 18000, reset_at: 100, used_percent: 25 };
    const second = { ...first, seconds: 604800 };
    const accounts = [
      { quota: { windows: [first, second] } },
      { quota: { windows: [{ ...first, reset_at: 200 }] } },
    ] as Account[];
    expect(quotaOptions(accounts)).toHaveLength(2);
    expect(quotaWindowId(first)).not.toBe(quotaWindowId(second));
    expect(
      readHiddenQuotas({ getItem: () => JSON.stringify([quotaWindowId(first)]) }, 'test')
    ).toEqual([quotaWindowId(first)]);
    expect(readHiddenQuotas({ getItem: () => 'broken' }, 'test')).toEqual([]);
  });
  test('all QoL labels are present in all supported languages', () => {
    const locales = ['en', 'zh-CN', 'zh-TW', 'ru'].map(
      (locale) =>
        JSON.parse(readFileSync(resolve('src/i18n/locales', `${locale}.json`), 'utf8')).qol
    );
    for (const locale of locales)
      expect(Object.keys(locale).sort()).toEqual(Object.keys(locales[0]).sort());
  });
  test('new monitor does not hydrate the legacy full usage snapshot', () => {
    const page = readFileSync(resolve('src/features/qol/QolPage.tsx'), 'utf8');
    expect(page).not.toContain('useUsageData');
    expect(page).not.toContain('useUsageStatsStore');
    expect(page).toMatch(/qolApi\s*\.summary/);
    expect(page).toMatch(/qolApi\s*\.requests/);
    expect(page).toContain('controller.abort()');
  });
  test('mobile details use native keyboard-accessible disclosure and masked keys', () => {
    const cards = readFileSync(resolve('src/features/qol/RequestCards.tsx'), 'utf8');
    expect(cards).toContain('<summary>');
    expect(cards).toContain('r.key_label');
    expect(cards).not.toContain('api_key');
  });
});
