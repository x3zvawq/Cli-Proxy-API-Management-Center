import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('CPA QoL contracts', () => {
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
