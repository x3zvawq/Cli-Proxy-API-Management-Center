export interface ContextBlock {
  role: string;
  kind: 'text' | 'tool_call' | 'tool_result' | 'reasoning' | 'media' | 'data';
  type: string;
  text: string;
  name?: string;
  callId?: string;
}

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const string = (value: unknown) => (typeof value === 'string' ? value : '');
const json = (value: unknown) => JSON.stringify(value, null, 2) ?? '';

// Protocol normalization only. Markdown parsing/rendering is owned by remark.
export function contextBlocks(body: string): ContextBlock[] | null {
  let root: Record<string, unknown> | null;
  try {
    root = object(JSON.parse(body));
  } catch {
    return null;
  }
  if (!root) return null;
  const blocks: ContextBlock[] = [];
  const content = (value: unknown, role: string): void => {
    if (typeof value === 'string') {
      blocks.push({ role, kind: 'text', type: 'text', text: value });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => content(item, role));
      return;
    }
    const item = object(value);
    if (!item) {
      if (value != null) blocks.push({ role, kind: 'data', type: 'data', text: json(value) });
      return;
    }
    const type = string(item.type) || (typeof item.text === 'string' ? 'text' : '');
    if (typeof item.role === 'string' || type === 'message') {
      const currentRole = string(item.role) || role;
      if (currentRole === 'tool' || currentRole === 'function') {
        blocks.push({
          role: 'tool',
          kind: 'tool_result',
          type: 'tool_result',
          text: typeof item.content === 'string' ? item.content : json(item.content),
          callId: string(item.tool_call_id),
          name: string(item.name),
        });
      } else content(item.content, currentRole);
      if (Array.isArray(item.tool_calls)) {
        item.tool_calls.forEach((call) => {
          const entry = object(call);
          const fn = object(entry?.function);
          blocks.push({
            role: currentRole,
            kind: 'tool_call',
            type: 'function_call',
            text: string(fn?.arguments) || json(fn?.arguments),
            name: string(fn?.name),
            callId: string(entry?.id),
          });
        });
      }
      if (item.function_call) {
        const fn = object(item.function_call);
        blocks.push({
          role: currentRole,
          kind: 'tool_call',
          type: 'function_call',
          text: string(fn?.arguments) || json(fn?.arguments),
          name: string(fn?.name),
        });
      }
      return;
    }
    if (['text', 'input_text', 'output_text', 'summary_text', 'refusal'].includes(type)) {
      blocks.push({ role, kind: 'text', type, text: string(item.text) || string(item.refusal) });
      return;
    }
    if (['function_call', 'tool_use', 'custom_tool_call'].includes(type)) {
      const argumentsValue = item.arguments ?? item.input;
      blocks.push({
        role: 'assistant',
        kind: 'tool_call',
        type,
        text: typeof argumentsValue === 'string' ? argumentsValue : json(argumentsValue),
        name: string(item.name),
        callId: string(item.call_id) || string(item.id),
      });
      return;
    }
    if (['function_call_output', 'tool_result', 'custom_tool_call_output'].includes(type)) {
      const result = item.output ?? item.content;
      blocks.push({
        role: 'tool',
        kind: 'tool_result',
        type,
        text: typeof result === 'string' ? result : json(result),
        callId: string(item.call_id) || string(item.tool_use_id),
      });
      return;
    }
    if (['reasoning', 'thinking', 'redacted_thinking'].includes(type)) {
      blocks.push({
        role: 'assistant',
        kind: 'reasoning',
        type,
        text:
          string(item.thinking) ||
          (Array.isArray(item.summary)
            ? item.summary.map((part) => string(object(part)?.text)).join('\n\n')
            : '') ||
          json(item),
      });
      return;
    }
    if (
      [
        'input_image',
        'image_url',
        'image',
        'input_audio',
        'audio',
        'input_file',
        'file',
        'video',
      ].includes(type)
    ) {
      // Never fetch embedded media URLs just because an administrator reads a log.
      blocks.push({
        role,
        kind: 'media',
        type,
        text: string(item.filename) || string(item.detail) || type,
      });
      return;
    }
    blocks.push({ role, kind: 'data', type: type || 'data', text: json(item) });
  };
  if (root.instructions != null) content(root.instructions, 'system');
  if (root.system != null) content(root.system, 'system');
  if (root.systemInstruction != null)
    content(object(root.systemInstruction)?.parts ?? root.systemInstruction, 'system');
  if (root.input != null) content(root.input, 'user');
  if (root.messages != null) content(root.messages, 'user');
  if (Array.isArray(root.contents))
    root.contents.forEach((item) => {
      const message = object(item);
      content(message?.parts, string(message?.role) || 'user');
    });
  if (root.prompt != null) content(root.prompt, 'user');
  if (root.tools != null)
    blocks.push({ role: 'system', kind: 'data', type: 'tools', text: json(root.tools) });
  return blocks.length ? blocks : [{ role: '', kind: 'data', type: 'data', text: json(root) }];
}
