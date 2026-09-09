import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Summary } from './api';
import { formatTokens } from './display';
import { compactMoney } from './metricFormatting';
import styles from './QolPage.module.scss';

export function UsageBreakdown({
  summary,
  names,
  keyLabel,
}: {
  summary: Summary | null;
  names: Map<string, string>;
  keyLabel: (id: string, stored: string) => string;
}) {
  const { t } = useTranslation();
  const [group, setGroup] = useState<'keys' | 'models' | 'accounts'>('keys');
  const label = group === 'keys' ? 'key' : group === 'models' ? 'model' : 'upstream_account';
  return (
    <section className={styles.panel}>
      <div className={styles.breakdownHeading}>
        <h2>{t('qol.breakdown')}</h2>
        <label>
          {t('qol.group_by')}
          <select value={group} onChange={(e) => setGroup(e.target.value as typeof group)}>
            <option value="keys">{t('qol.key')}</option>
            <option value="models">{t('qol.model')}</option>
            <option value="accounts">{t('qol.upstream_account')}</option>
          </select>
        </label>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {[
                label,
                'requests',
                'failed',
                'tokens',
                'cache_read',
                'cache_write',
                'cache_hit',
                'cost',
              ].map((id) => (
                <th key={id}>{t(`qol.${id}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary?.[group].map((row) => (
              <tr key={row.id}>
                <td data-label={t(`qol.${label}`)}>
                  {group === 'keys'
                    ? keyLabel(row.id, row.label)
                    : group === 'accounts'
                      ? names.get(row.id) || row.label || row.id || '—'
                      : row.label || row.id || '—'}
                </td>
                <td data-label={t('qol.requests')}>{row.requests.toLocaleString()}</td>
                <td data-label={t('qol.failed')}>{row.failures.toLocaleString()}</td>
                <td data-label={t('qol.tokens')}>{formatTokens(row.total)}</td>
                <td data-label={t('qol.cache_read')}>{formatTokens(row.cache_read)}</td>
                <td data-label={t('qol.cache_write')}>{formatTokens(row.cache_write)}</td>
                <td data-label={t('qol.cache_hit')}>
                  {row.context ? `${((100 * row.cache_read) / row.context).toFixed(1)}%` : '—'}
                </td>
                <td data-label={t('qol.cost')}>
                  <span title={row.priced ? '$' + row.cost.toFixed(8) : undefined}>
                    {row.priced ? compactMoney(row.cost) : '—'}
                  </span>
                  <small>
                    {row.priced} / {row.requests}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {summary && !summary[group].length && <p>{t('qol.empty')}</p>}
      {summary?.groups_truncated && <p>{t('qol.truncated')}</p>}
    </section>
  );
}
