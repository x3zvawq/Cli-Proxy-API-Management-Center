import { describe, test, expect } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { defaultColumns, selectedFields, pickFields } from '../src/features/qol/requestColumns';
import { RequestTable } from '../src/features/qol/RequestTable';
import { UsageBreakdown } from '../src/features/qol/UsageBreakdown';

describe('request projection UI', () => {
  test('defaults remain compact; cost and token dependencies are explicit', () => {
    const fields = selectedFields(defaultColumns).split(',');
    expect(fields).not.toContain('failure_body');
    expect(fields).not.toContain('raw_tokens');
    expect(defaultColumns.indexOf('cost')).toBe(defaultColumns.indexOf('tokens') + 1);
    expect(defaultColumns).toContain('thinking');
    expect(selectedFields(['time'])).toBe('id,timestamp');
    expect(selectedFields(['failure_body'])).toBe('id,failure_body');
    expect(selectedFields(['cost'])).toContain('cache_read');
    expect(pickFields({ id: 'one' }, ['ttft_ms'])).toBeNull();
  });
  test('desktop and mobile respect selection, even without default fields', () => {
    const html = renderToStaticMarkup(
      createElement(RequestTable, {
        rows: [{ id: 'one', alias: '<script>literal</script>' }],
        columns: ['alias'],
        names: new Map(),
        keyLabel: (_, label) => label,
      })
    );
    expect(html).toContain('<summary>');
    expect(html).toContain('&lt;script&gt;literal&lt;/script&gt;');
    expect(html).not.toContain('qol.tokens');
    expect(html).not.toContain('NaN');
  });
  test('group dimensions are keyboard accessible radios', () => {
    const html = renderToStaticMarkup(
      createElement(UsageBreakdown, {
        summary: null,
        names: new Map(),
        keyLabel: (_, label) => label,
      })
    );
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/type="radio"/g)?.length).toBe(3);
    expect(html).not.toContain('<select');
  });
  test('foreground polling is bounded and preserves pagination', () => {
    const source = readFileSync('src/features/qol/QolPage.tsx', 'utf8');
    expect(source).toContain('document.hidden || loading || summaryLoading');
    expect(source).toContain('relativeDays !== null && page === 1');
    expect(source).toContain('setInterval(refresh, 30000)');
    expect(source).toContain("removeEventListener('visibilitychange', refresh)");
    expect(source).not.toContain('setRequests(null)');
  });
});
