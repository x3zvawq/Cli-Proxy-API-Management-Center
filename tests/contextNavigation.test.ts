import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import en from '../src/i18n/locales/en.json';
import { ContextJump } from '../src/features/qol/ContextJump';
import { messageOffset } from '../src/features/qol/contextDisplay';
import { ContextReadable } from '../src/features/qol/ContextReadable';

test('message positions are one-based and invalid jumps are rejected', () => {
  expect(messageOffset(1, 80)).toBe(0);
  expect(messageOffset(61, 80)).toBe(60);
  expect(messageOffset(80, 80)).toBe(79);
  for (const value of [0, -1, 81, 1.5, NaN, Infinity]) expect(messageOffset(value, 80)).toBeNull();
  expect(messageOffset(1, 0)).toBeNull();
});
test('reader exposes message navigation, folding and bounded visible blocks', async () => {
  const i18n = createInstance();
  await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
  const html = renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(ContextReadable, {
        body: JSON.stringify({
          input: Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `Message ${i}` })),
        }),
      })
    )
  );
  expect(html).toContain('Message navigation');
  expect(html).toContain('Expand all');
  expect(html).toContain('Collapse all');
  expect((html.match(/aria-expanded="true"/g) || []).length).toBe(20);
  expect(html).toContain('Go to current content block');
  expect(html).not.toContain('Message 29');
  const jump = renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(ContextJump, { current: 60, total: 80, onJump: () => {} })
    )
  );
  expect(jump).toContain('value="61"');
  expect(jump).toContain('max="80"');
});
