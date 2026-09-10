import type { ConversationDirectoryItem } from './api';

export const conversationCategories = ['user', 'assistant', 'thinking', 'tool', 'system', 'other'];
export function filterConversationItems(
  items: ConversationDirectoryItem[],
  categories: string[],
  query: string
) {
  const text = query.trim().toLocaleLowerCase();
  return items.filter(
    (item) =>
      categories.includes(item.category) &&
      (!text ||
        `${item.position} ${item.label} ${item.preview} ${item.role} ${item.type}`
          .toLocaleLowerCase()
          .includes(text))
  );
}
