import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import en from '../src/i18n/locales/en.json';
import { contextBlocks } from '../src/features/qol/contextBlocks';
import { ContextReadable } from '../src/features/qol/ContextReadable';

test('Responses context preserves instructions, message order, tool calls and outputs', () => {
  const blocks = contextBlocks(
    JSON.stringify({
      instructions: '# System',
      input: [
        { role: 'user', content: [{ type: 'input_text', text: 'Question' }] },
        { type: 'function_call', name: 'shell', call_id: 'call-1', arguments: '{"command":"pwd"}' },
        { type: 'function_call_output', call_id: 'call-1', output: '/example' },
        { role: 'assistant', content: [{ type: 'output_text', text: '**Answer**' }] },
      ],
    })
  );
  expect(blocks?.map((b) => b.role)).toEqual(['system', 'user', 'assistant', 'tool', 'assistant']);
  expect(blocks?.map((b) => b.kind)).toEqual(['text', 'text', 'tool_call', 'tool_result', 'text']);
  expect(blocks?.[2].callId).toBe('call-1');
  expect(blocks?.[4].text).toBe('**Answer**');
});

test('Chat and Anthropic content blocks retain system prompts and structured data', () => {
  const blocks = contextBlocks(
    JSON.stringify({
      system: [{ type: 'text', text: 'policy' }],
      messages: [
        {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'a', function: { name: 'search', arguments: '{}' } }],
        },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'a', content: 'result' }] },
      ],
      tools: [{ name: 'search' }],
    })
  );
  expect(blocks?.map((b) => b.kind)).toEqual(['text', 'tool_call', 'tool_result', 'data']);
  expect(blocks?.at(-1)?.type).toBe('tools');
  expect(contextBlocks('{"truncated')).toBeNull();
});

test('Markdown uses GFM without HTML execution or remote image requests', async () => {
  const i18n = createInstance();
  await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
  const html = renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(ContextReadable, {
        body: JSON.stringify({
          input:
            '**bold**\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n<script>bad()</script>\n\n![tracking](https://example.test/track)\n\n[bad](javascript:alert(1))',
        }),
      })
    )
  );
  expect(html).toContain('<strong>bold</strong>');
  expect(html).toContain('<table>');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('<img');
  expect(html).not.toContain('href="javascript:');
});
