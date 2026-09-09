import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { qolApi, refreshAndWait, type Account } from './api';

export function useQuotaRefresh(onAccounts: (accounts: Account[]) => void) {
  const { t } = useTranslation();
  const current = useRef<AbortController | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(
    () => () => {
      current.current?.abort();
    },
    []
  );
  const refresh = useCallback(
    async (account?: string) => {
      if (current.current) return;
      const controller = new AbortController();
      current.current = controller;
      setRefreshing(true);
      setStatus('');
      try {
        const job = await refreshAndWait(account, controller.signal);
        const accounts = await qolApi.accounts(controller.signal);
        controller.signal.throwIfAborted();
        onAccounts(accounts);
        const failures = Object.values(job.errors);
        if (failures.length)
          throw new Error(`${t('qol.refresh_failed')} ${[...new Set(failures)].join('; ')}`);
      } catch (e) {
        if (!controller.signal.aborted) {
          setStatus(e instanceof Error ? e.message : String(e));
          throw e;
        }
      } finally {
        if (!controller.signal.aborted) {
          setRefreshing(false);
          current.current = null;
        }
      }
    },
    [onAccounts, t]
  );
  return { refresh, refreshing, status };
}
