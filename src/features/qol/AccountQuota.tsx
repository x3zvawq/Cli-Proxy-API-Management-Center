import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { IconRefreshCw, IconTimer } from '@/components/ui/icons';
import { authFilesApi } from '@/services/api/authFiles';
import { consumeCodexRateLimitResetCredit } from '@/features/quota/providers/codex/data';
import { type Account } from './api';
import {
  accountLabel,
  canResetQuota,
  formatTokens,
  quotaLabel,
  quotaWindowId,
  quotaTone,
} from './display';
import styles from './AccountQuota.module.scss';

const money = (value: number | null | undefined) => (value == null ? '—' : `$${value.toFixed(2)}`);

export function AccountQuota({
  account,
  hidden,
  onRefresh,
  refreshing,
}: {
  account: Account;
  hidden: string[];
  onRefresh: (account?: string) => Promise<void>;
  refreshing: boolean;
}) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [resetAt, setResetAt] = useState(0);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const q = account.quota;
  const waiting = resetAt > Date.parse(q?.updated_at || '1970-01-01');
  const run = async (reset: boolean) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    setConfirm(false);
    try {
      if (reset) {
        setResetAt(Date.now());
        const files = await authFilesApi.list();
        if (!active.current) return;
        const file = files.files.find(
          (f) => String(f.auth_index ?? f.authIndex) === account.auth_index
        );
        if (!file) throw new Error(t('qol.account_missing'));
        // No automatic retry: the existing endpoint uses a unique redeem request ID.
        await consumeCodexRateLimitResetCredit(file, t);
      }
      if (!active.current) return;
      await onRefresh(account.auth_index);
      if (active.current && reset) setMessage(t('qol.reset_accepted'));
    } catch (error) {
      setMessage(
        `${error instanceof Error ? error.message : String(error)}${reset ? ` · ${t('qol.reset_uncertain')}` : ''}`
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <div className={styles.cell}>
      {q?.windows
        .filter((w) => !hidden.includes(quotaWindowId(w)))
        .map((w, i) => {
          const u = w.usage;
          const label = quotaLabel(w);
          return (
            <div className={styles.window} key={`${w.name}-${i}`}>
              <div
                className={styles.metrics}
                title={
                  u
                    ? `${t('qol.cycle_snapshot')}: ${new Date(u.start).toLocaleString()} — ${new Date(u.end).toLocaleString()}\n${t('qol.estimate_hint')}`
                    : t('qol.pool_unknown')
                }
              >
                <span title={t('qol.requests')}>{u ? u.requests.toLocaleString() : '—'} req</span>
                <span title={`${t('qol.total')}: ${u ? u.total.toLocaleString() : '—'}`}>
                  {u ? formatTokens(u.total) : '—'} tok
                </span>
                <span title={t('qol.used_cost')}>used {money(u?.priced ? u.cost : null)}</span>
                <span
                  title={`${t('qol.ptu_hint')} · ${t('qol.cost_hint', { priced: u?.priced || 0, total: u?.requests || 0 })}`}
                >
                  ptu {money(u?.estimated_total)}
                  {u?.estimated_total != null && u.priced < u.requests
                    ? ` (${t('qol.partial')})`
                    : ''}
                </span>
              </div>
              <div className={`${styles.quotaLine} ${styles[quotaTone(w.used_percent)]}`}>
                <strong>{label}</strong>
                <progress
                  max={100}
                  value={w.used_percent}
                  aria-label={`${label} ${t('qol.used')}`}
                />
                <span title={t('qol.used')}>{Math.round(w.used_percent)}%</span>
                <time
                  title={t('qol.auto_reset')}
                  dateTime={w.reset_at ? new Date(w.reset_at * 1000).toISOString() : undefined}
                >
                  {w.reset_at ? new Date(w.reset_at * 1000).toLocaleString() : '—'}
                </time>
              </div>
            </div>
          );
        })}
      <div className={styles.actions}>
        <button
          className={styles.textButton}
          disabled={busy || refreshing || account.disabled}
          aria-busy={busy}
          onClick={() => void run(false)}
        >
          <IconRefreshCw size={13} className={busy ? styles.spinning : undefined} />
          {t(busy ? 'qol.refreshing' : 'qol.refresh')}
        </button>
        <span
          title={`${t('qol.reset_account_scope')} ${t('qol.applicable_hint', { count: q?.applicable_reset_credits ?? '—' })}`}
        >
          {t('qol.reset_counts', {
            total: q?.reset_credits ?? '—',
            applicable: q?.applicable_reset_credits ?? '—',
          })}
        </span>
        <button
          className={styles.textButton}
          disabled={busy || refreshing || waiting || account.disabled || !canResetQuota(q)}
          onClick={() => setConfirm(true)}
        >
          <IconTimer size={13} />
          {t('qol.reset_action')}
        </button>
      </div>
      <small>
        {t('qol.updated')}{' '}
        {q?.updated_at ? new Date(q.updated_at).toLocaleString() : t('qol.unknown')}
      </small>
      {(message || q?.error || q?.reset_credits_error) && (
        <small role="status">{message || q?.error || q?.reset_credits_error}</small>
      )}
      <Modal
        open={confirm}
        title={t('qol.reset_confirm_title')}
        onClose={() => setConfirm(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={busy || !canResetQuota(q)}
              onClick={() => void run(true)}
            >
              {t('qol.reset_confirm')}
            </Button>
          </>
        }
      >
        <p>{t('qol.reset_confirm_body', { account: accountLabel(account) })}</p>
      </Modal>
    </div>
  );
}
