export const retentionSteps = [1, 3, 6, 12, 24, 48, 72, 168, 336, 720];

export function messageOffset(value: number, total: number): number | null {
  return Number.isInteger(value) && value >= 1 && value <= total ? value - 1 : null;
}

export function storageSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const index = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(1)} ${['B', 'KiB', 'MiB', 'GiB'][index]}`;
}

export function contextText(body: string) {
  // Do not repeatedly pretty-print multi-megabyte contexts in the browser.
  if (body.length <= 256 * 1024) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      /* Truncated or non-JSON input. */
    }
  }
  return body;
}
