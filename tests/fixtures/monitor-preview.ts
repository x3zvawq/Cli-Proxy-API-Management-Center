// Local, synthetic browser fixture. Run after build with: bun tests/fixtures/monitor-preview.ts
import { serve, file } from 'bun';

const keys = ['sk-fixture-client-alpha-000001', 'sk-fixture-client-bravo-000002'];
const records = Array.from({ length: 125 }, (_, index) => ({
  id: `fixture-${index}`,
  timestamp: new Date(Date.parse('2026-09-07T02:00:00Z') + index * 60_000).toISOString(),
  source: 'demo@example.test.json',
  auth_index: 'fixture-auth',
  provider: 'codex',
  executor_type: index % 2 === 0 ? 'CodexWebsocketsExecutor' : 'CodexExecutor',
  service_tier: 'priority',
  reasoning_effort: 'high',
  failed: index % 10 === 0,
  ...(index % 10 === 0
    ? { failure_status_code: 429, failure_body: 'Synthetic rate limit for UI verification' }
    : {}),
  latency_ms: 2300 + index * 100,
  ttft_ms: 300 + index * 10,
  tokens: {
    input_tokens: 1000 + index * 10,
    output_tokens: 100,
    reasoning_tokens: 40,
    cached_tokens: 800,
    cache_creation_tokens: 50,
    total_tokens: 1100 + index * 10,
  },
}));

serve({
  hostname: '127.0.0.1',
  port: 4179,
  fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return new Response('Read-only fixture', { status: 405 });
    if (!url.pathname.startsWith('/v0/management/'))
      return new Response(file(new URL('../../dist/index.html', import.meta.url)));
    let body: unknown = {};
    if (url.pathname.endsWith('/config')) body = { 'api-keys': keys };
    if (url.pathname.endsWith('/auth-files'))
      body = {
        files: [
          {
            name: 'demo@example.test.json',
            auth_index: 'fixture-auth',
            provider: 'codex',
            type: 'codex',
          },
        ],
      };
    if (url.pathname.endsWith('/usage')) {
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      console.info('usage range', { start, end });
      body = Object.fromEntries(
        keys.map((key, keyIndex) => [
          key,
          {
            'fixture-model': records.filter(
              (r, i) =>
                i % 2 === keyIndex &&
                (!start || r.timestamp >= start) &&
                (!end || r.timestamp < end)
            ),
          },
        ])
      );
    }
    return Response.json(body, {
      headers: { 'X-CPA-Support-Plugin': 'true', 'X-CPA-Version': 'synthetic-fixture' },
    });
  },
});
console.info(
  'Synthetic monitoring preview at http://127.0.0.1:4179/management.html#/login — use any nonempty demo password.'
);
