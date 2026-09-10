import { afterEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import {
  CODEX_PRICE_MODELS,
  getDefaultSyncSettings,
  syncCodexPrices,
  syncPrices,
} from '../src/utils/priceSync';
import { PriceSettingsCard } from '../src/components/usage/PriceSettingsCard';
import en from '../src/i18n/locales/en.json';
import zh from '../src/i18n/locales/zh-CN.json';
import tw from '../src/i18n/locales/zh-TW.json';
import ru from '../src/i18n/locales/ru.json';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const cost = {
  input: 2,
  output: 12,
  cache_read: 0.2,
  cache_write: 2.5,
  tiers: [
    {
      tier: { type: 'context', size: 272000 },
      input: 4,
      output: 18,
      cache_read: 0.4,
      cache_write: 5,
    },
  ],
};
const mockPrices = (data: unknown) => {
  globalThis.fetch = (async () => Response.json(data)) as typeof fetch;
};

describe('Codex catalog price synchronization', () => {
  test('syncs the entire catalog without usage records and uses only OpenAI rates', async () => {
    const models = Object.fromEntries(CODEX_PRICE_MODELS.map((name) => [name, { cost }]));
    mockPrices({
      openai: { models },
      reseller: {
        models: {
          'gpt-5.6-terra': { cost: { input: 999, output: 999 } },
        },
      },
    });
    const result = await syncCodexPrices();
    expect(result.matchedCount).toBe(CODEX_PRICE_MODELS.length);
    expect(result.totalModels).toBe(CODEX_PRICE_MODELS.length);
    expect(result.prices['gpt-5.6-terra']).toEqual({
      input: 2,
      output: 12,
      cacheRead: 0.2,
      cacheCreate: 2.5,
      contextTiers: [{ threshold: 272000, input: 4, output: 18, cacheRead: 0.4, cacheCreate: 5 }],
    });
  });
  test('does not invent zero prices or borrow a missing model from a reseller', async () => {
    mockPrices({
      openai: { models: { 'gpt-5.5': {}, 'gpt-6-astra': { cost } } },
      reseller: { models: { 'gpt-5.5': { cost } } },
    });
    const result = await syncCodexPrices();
    expect(Object.keys(result.prices)).toEqual(['gpt-6-astra']);
    expect(result.matchedCount).toBe(1);
  });
  test('retains advanced sync for other models and accepts explicitly free prices', async () => {
    mockPrices({ anthropic: { models: { 'fixture-model': { cost: { input: 0, output: 0 } } } } });
    expect(
      (await syncPrices(['fixture-model'], getDefaultSyncSettings())).prices['fixture-model'].input
    ).toBe(0);
  });
  test('reports source failure without producing replacement prices', async () => {
    globalThis.fetch = (async () => new Response('', { status: 503 })) as typeof fetch;
    await expect(syncCodexPrices()).rejects.toThrow('503');
  });
  test('price controls are available without usage and the header entry is outside charts', async () => {
    // Locale belongs to this test, not the runner's navigator or other suites.
    for (const [language, locale] of [
      ['zh-CN', zh],
      ['en', en],
    ] as const) {
      const i18n = createInstance();
      await i18n.init({ lng: language, resources: { [language]: { translation: locale } } });
      const html = renderToStaticMarkup(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(PriceSettingsCard, {
            modelNames: [],
            modelPrices: {},
            onPricesChange: () => {},
          })
        )
      );
      expect(html).toContain('models.dev');
      expect(html).toContain(locale.monitor_custom.advanced_sync);
      expect(html).not.toContain(locale.monitor_custom.sync_codex);
    }
    const page = await Bun.file(
      new URL('../src/pages/MonitoringCenterPage.tsx', import.meta.url)
    ).text();
    expect(page).toContain('aria-controls="monitor-model-prices"');
    expect(page.indexOf('<section id="monitor-model-prices"')).toBeLessThan(
      page.indexOf('<MonitorStatCards')
    );
    expect(page.match(/<PriceSettingsCard/g)).toHaveLength(1);
  });
  test('all new price UI labels are translated', () => {
    for (const locale of [en, zh, tw, ru]) {
      for (const key of [
        'price_entry',
        'sync_codex',
        'advanced_sync',
        'codex_price_hint',
        'codex_sync_success',
        'codex_sync_missing',
      ] as const) {
        expect(locale.monitor_custom[key].length).toBeGreaterThan(0);
      }
    }
  });
});
