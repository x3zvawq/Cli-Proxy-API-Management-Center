// Start ../cpa-qol/cmd/preview on 4179, then run this fixture on 4180.
// All content is synthetic; key: preview-only. No production connections.
import { serve, file, gzipSync } from 'bun';
const prefix = '/v0/management/plugins/cpa-qol/';
const timestamp = new Date().toISOString();
const input = Array.from({ length: 80 }, (_, i) => ({
  id: `message-${i}`,
  role: i % 2 ? 'assistant' : 'user',
  content:
    i === 0
      ? '# Long message\n\n' +
        'A long synthetic paragraph for scrolling and segment navigation.\n\n'.repeat(1300)
      : `## Message ${i + 1}\n\nSynthetic content **${i + 1}**.\n\n` +
        'More readable text.\n\n'.repeat(8),
}));
const gzip = (value: unknown) => Buffer.from(gzipSync(JSON.stringify(value))).toString('base64');
serve({
  hostname: '127.0.0.1',
  port: 4180,
  async fetch(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/v0/management/'))
      return new Response(file(new URL('../../dist/index.html', import.meta.url)));
    if (request.headers.get('Authorization') !== 'Bearer preview-only')
      return new Response('Unauthorized', { status: 401 });
    let value: unknown;
    switch (url.pathname.slice(prefix.length)) {
      case 'context-settings':
        value = {
          enabled: true,
          retention_hours: 336,
          records: 3,
          stored_bytes: 12345,
          disk_bytes: 23456,
          limit_bytes: 1073741824,
          dropped: 0,
          write_errors: 0,
        };
        break;
      case 'conversations':
        value = {
          items: [
            {
              id: 'fixture-session',
              session: 'codex:fixture',
              key_label: 'demo0…',
              model: 'fixture-model',
              timestamp,
              requests: 3,
            },
          ],
          total: 1,
        };
        break;
      case 'conversation': {
        await Bun.sleep(1200);
        const offset = Number(url.searchParams.get('offset') || 0);
        const end = Math.min(offset + 20, input.length);
        value = {
          id: 'fixture-session',
          total: 80,
          requests: 3,
          offset,
          next_offset: end,
          order_conflict: false,
          items_gzip: gzip(
            input
              .slice(offset, end)
              .map((item, i) => ({
                id: item.id,
                field: 'input',
                value: item,
                request_id: `fixture-${i}`,
                references: 3,
                parents: 1,
              }))
          ),
        };
        break;
      }
      case 'contexts':
        value = {
          items: [
            {
              id: 'snapshot-one',
              timestamp,
              model: 'fixture-model',
              format: 'openai-response',
              session: 'codex:fixture',
              stream: true,
              original_bytes: 100000,
              stored_bytes: 12000,
              truncated: false,
              group_id: 'fixture-session',
              key_label: 'demo0…',
              client: { user_agent: 'synthetic-preview' },
            },
          ],
          total: 1,
        };
        break;
      case 'context':
        await Bun.sleep(1200);
        value = { id: 'snapshot-one', body_gzip: gzip({ input }), truncated: false };
        break;
      default:
        return fetch(new Request('http://127.0.0.1:4179' + url.pathname + url.search, request));
    }
    return Response.json(value, {
      headers: { 'X-CPA-Support-Plugin': 'true', 'X-CPA-Version': 'drawer-fixture' },
    });
  },
});
console.info(
  'Context drawer fixture: http://127.0.0.1:4180/management.html#/monitor ; key preview-only'
);
