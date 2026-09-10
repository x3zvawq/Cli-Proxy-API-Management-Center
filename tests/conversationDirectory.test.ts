import { expect, test } from 'bun:test';
import {
  filterConversationItems,
  conversationCategories,
} from '../src/features/qol/conversationDirectory';
import { candyPrompt, pelicanDocument } from '../src/features/qol/probePresets';
import type { ConversationDirectoryItem } from '../src/features/qol/api';

test('directory filters the full metadata index without bodies or renumbering', () => {
  const items: ConversationDirectoryItem[] = Array.from({ length: 80 }, (_, i) => ({
    id: String(i),
    position: i + 1,
    references: 2,
    role: i % 2 ? 'assistant' : 'user',
    type: 'message',
    category: i % 2 ? 'assistant' : 'user',
    label: '',
    preview: `Message ${i + 1}`,
  }));
  expect(filterConversationItems(items, ['user'], '').length).toBe(40);
  expect(filterConversationItems(items, conversationCategories, 'MESSAGE 80')[0].position).toBe(80);
  expect(filterConversationItems(items, [], '')).toEqual([]);
  expect(filterConversationItems(items, ['user'], 'Message 80')).toEqual([]);
});
test('candy preset preserves the supplied table and does not inject a scoring answer', () => {
  expect(candyPrompt).toContain('圆形       7      9      8');
  expect(candyPrompt).toContain('五角星形   7      6      4');
  expect(candyPrompt).not.toContain('正确答案');
});
test('HTML preview has an early restrictive CSP, supports fenced SVG and does not fabricate HTML', () => {
  expect(pelicanDocument('plain reply')).toBeNull();
  const doc = pelicanDocument('```svg\n<svg><text>Hello &amp; world</text></svg>\n```')!;
  expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('<svg>'));
  expect(doc).toContain("default-src 'none'");
  expect(doc).not.toContain('allow-scripts');
  expect(doc).toContain('Hello &amp; world');
});
