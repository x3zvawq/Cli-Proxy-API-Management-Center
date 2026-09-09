import { useTranslation } from 'react-i18next';
import type { RequestRow } from './api';
import styles from './QolPage.module.scss';

export function RequestCards({
  rows,
  names,
  keyLabel,
  onDetail,
}: {
  rows: RequestRow[];
  names: Map<string, string>;
  keyLabel: (id: string, stored: string) => string;
  onDetail: (row: RequestRow) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.requestCards}>
      {rows.map((r) => (
        <details key={r.id}>
          <summary>
            <strong>{r.model}</strong>
            <span>{r.cost === null ? '—' : `$${r.cost.toFixed(5)}`}</span>
            <small>
              {new Date(r.timestamp).toLocaleString()} ·{' '}
              {t(r.failed ? 'qol.failed' : 'qol.success')}
            </small>
            <small>
              {keyLabel(r.key, r.key_label)} · ↑ {r.context.toLocaleString()} / ↓{' '}
              {r.output.toLocaleString()}
            </small>
          </summary>
          <dl className={styles.details}>
            <div>
              <dt>{t('qol.accounts')}</dt>
              <dd>{names.get(r.account) || r.account || '—'}</dd>
            </div>
            <div>
              <dt>{t('qol.tier')}</dt>
              <dd>
                {r.tier || '—'} / {r.thinking || '—'}
              </dd>
            </div>
            <div>
              <dt>{t('qol.timing')}</dt>
              <dd>
                {r.ttft_ms ? `${(r.ttft_ms / 1000).toFixed(2)}s` : '—'} /{' '}
                {r.ttft_ms > 0 && r.latency_ms > r.ttft_ms
                  ? `${((r.latency_ms - r.ttft_ms) / 1000).toFixed(2)}s · ${(r.output / ((r.latency_ms - r.ttft_ms) / 1000)).toFixed(1)} TPS`
                  : '—'}
              </dd>
            </div>
          </dl>
          <button className={styles.tokenButton} onClick={() => onDetail(r)}>
            {t('qol.tokens')} ⓘ
          </button>
        </details>
      ))}
    </div>
  );
}
