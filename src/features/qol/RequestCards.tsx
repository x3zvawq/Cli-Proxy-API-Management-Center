import { useTranslation } from 'react-i18next';
import type { RequestRow } from './api';
import { formatTokens } from './display';
import { compactMoney } from './metricFormatting';
import { RequestTokens, RequestCost, RequestTiming, RequestTransport } from './RequestMetrics';
import styles from './QolPage.module.scss';

export function RequestCards({
  rows,
  names,
  keyLabel,
}: {
  rows: RequestRow[];
  names: Map<string, string>;
  keyLabel: (id: string, stored: string) => string;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.requestCards}>
      {rows.map((r) => (
        <details key={r.id}>
          <summary>
            <strong>{r.model}</strong>
            <span>{compactMoney(r.cost)}</span>
            <small>
              {new Date(r.timestamp).toLocaleString()} ·{' '}
              {t(r.failed ? 'qol.failed' : 'qol.success')}
            </small>
            <RequestTransport row={r} />
            <small>
              {keyLabel(r.key, r.key_label)} · ↑ {formatTokens(r.context)} / ↓{' '}
              {formatTokens(r.output)}
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
          </dl>
          <div className={styles.mobileMetrics}>
            <RequestTokens row={r} />
            <RequestTiming row={r} />
          </div>
          <RequestCost row={r} />
        </details>
      ))}
    </div>
  );
}
