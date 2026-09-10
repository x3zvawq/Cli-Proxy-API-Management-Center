import { expect, test } from 'bun:test';
import { contextText, retentionSteps, storageSize } from '../src/features/qol/contextDisplay';

test('context retention and binary storage units', () => {
  expect(retentionSteps[0]).toBe(1);
  expect(retentionSteps.at(-1)).toBe(720);
  expect(retentionSteps.includes(24)).toBe(true);
  expect(storageSize(0)).toBe('0 B');
  expect(storageSize(1048576)).toBe('1.0 MiB');
  expect(storageSize(1073741824)).toBe('1.0 GiB');
});

test('context rendering preserves text and avoids formatting huge bodies', () => {
  expect(contextText('{"input":"hello"}')).toBe('{\n  "input": "hello"\n}');
  expect(contextText('{"truncated')).toBe('{"truncated');
  const large = JSON.stringify({ input: 'x'.repeat(300000) });
  expect(contextText(large)).toBe(large);
  expect(contextText('<script>text</script>')).toBe('<script>text</script>');
});
