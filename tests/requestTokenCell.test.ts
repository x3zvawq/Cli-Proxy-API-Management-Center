import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import '../src/i18n';
import { RequestTokenCell } from '../src/components/usage/RequestTokenCell';
import en from '../src/i18n/locales/en.json';
import zh from '../src/i18n/locales/zh-CN.json';
import tw from '../src/i18n/locales/zh-TW.json';
import ru from '../src/i18n/locales/ru.json';

describe('compact request token cell', () => {
  test('renders two-line context summary and an accessible details trigger', () => {
    const html = renderToStaticMarkup(
      createElement(RequestTokenCell, {
        metrics: {
          inputTokens: 1000,
          outputTokens: 100,
          reasoningTokens: 40,
          cachedTokens: 800,
          cacheCreationTokens: 0,
          totalTokens: 1100,
          contextTokens: 1000,
          cacheHitRatio: 0.8,
        },
      })
    );
    expect(html).toContain('↑');
    expect(html).toContain('↓');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label=');
    expect(html).not.toContain('role="tooltip"');
  });
  test('all new labels are translated in all locales', () => {
    for (const language of [en, zh, tw, ru]) {
      for (const key of [
        'token_column',
        'token_details',
        'context',
        'context_short',
        'context_hint',
        'cache_write',
        'cache_summary',
        'weighted_cache_hit',
        'context_sum',
        'cache_summary_hint',
      ] as const) {
        expect(language.monitor_custom[key].length).toBeGreaterThan(0);
      }
    }
  });
});
