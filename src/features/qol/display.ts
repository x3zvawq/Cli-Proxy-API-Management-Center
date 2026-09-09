import type { Account, Quota } from './api';

export type UsageView = 'monitor' | 'accounts' | 'prices';

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
              { id: quotaWindowId(window), label: `${window.name} · ${window.seconds / 3600}h` },
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
