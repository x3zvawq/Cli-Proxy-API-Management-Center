import type { Account, Quota } from './api';

export type UsageView = 'monitor' | 'accounts' | 'prices';

export const quotaDuration = (seconds: number) =>
  seconds > 0 && seconds % 86400 === 0 ? `${seconds / 86400}d` : `${seconds / 3600}h`;

export function quotaLabel(window: Quota['windows'][number]) {
  const name = window.name.toLowerCase();
  const period = quotaDuration(window.seconds);
  return name === 'codex'
    ? period
    : name.includes('spark')
      ? `spark-${period}`
      : `${window.name} · ${period}`;
}

export const relativeTimeRange = (days: number, now = Date.now()) => ({
  start: new Date(now - days * 86400000).toISOString(),
  end: new Date(now).toISOString(),
});

export const canResetQuota = (quota: Quota | undefined) => (quota?.reset_credits ?? 0) > 0;

export const accountLabel = (account: Account) =>
  account.display_name || account.email || account.name;
export const formatTokens = (value: number) =>
  value >= 1e9
    ? `${(value / 1e9).toFixed(2)}B`
    : value >= 1e6
      ? `${(value / 1e6).toFixed(2)}M`
      : value >= 1e3
        ? `${(value / 1e3).toFixed(1)}K`
        : `${value}`;
export const quotaTone = (used: number) => (used < 60 ? 'low' : used < 85 ? 'medium' : 'high');

export const quotaWindowId = (window: Quota['windows'][number]) =>
  JSON.stringify([window.name, window.seconds]);

export function quotaOptions(accounts: Account[]) {
  return Array.from(
    new Map(
      accounts.flatMap((account) =>
        (account.quota?.windows || []).map(
          (window) =>
            [
              quotaWindowId(window),
              { id: quotaWindowId(window), label: quotaLabel(window) },
            ] as const
        )
      )
    ).values()
  );
}

export function readHiddenQuotas(storage: Pick<Storage, 'getItem'>, key: string): string[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(value) && value.every((id) => typeof id === 'string') ? value : [];
  } catch {
    return [];
  }
}

// Match the stable IDs already stored by QoL. Never persist or render the full key.
export async function keyPrefixes(keys: string[]): Promise<Record<string, string>> {
  return Object.fromEntries(
    await Promise.all(
      keys.map(async (key) => {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
        const id = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0')
        ).join('');
        return [id, `${key.slice(0, 6)}…`];
      })
    )
  );
}
