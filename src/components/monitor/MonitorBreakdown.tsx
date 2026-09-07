import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { summarizeMonitorUsage } from '@/utils/monitorAnalytics';
import { formatDurationMs } from '@/utils/usage';
import styles from '@/pages/MonitoringCenterPage.module.scss';

export function MonitorBreakdown({ usage, loading }: { usage: unknown; loading: boolean }) {
  const { t } = useTranslation();
  const stats = useMemo(() => summarizeMonitorUsage(usage), [usage]);
  const total = stats.success + stats.failure;
  const items = [
    [
      t('monitor_custom.success_rate'),
      total ? `${((stats.success / total) * 100).toFixed(1)}%` : '--',
    ],
    [
      t('monitor_custom.success_failure'),
      `${stats.success.toLocaleString()} / ${stats.failure.toLocaleString()}`,
    ],
    [t('usage_stats.input_tokens'), stats.input.toLocaleString()],
    [t('usage_stats.output_tokens'), stats.output.toLocaleString()],
    [t('usage_stats.reasoning_tokens'), stats.reasoning.toLocaleString()],
    ['TTFT P50', formatDurationMs(stats.ttftP50)],
    ['TTFT P95', formatDurationMs(stats.ttftP95)],
  ];
  return (
    <section aria-label={t('monitor_custom.breakdown')} className={styles.breakdownPanel}>
      <div className={styles.breakdownGrid}>
        {items.map(([label, value]) => (
          <div key={label}>
            <div className={styles.statLabel}>{label}</div>
            <strong>{loading ? '--' : value}</strong>
          </div>
        ))}
      </div>
      <div className={styles.cacheSummary} aria-label={t('monitor_custom.cache_summary')}>
        <h3>{t('monitor_custom.cache_summary')}</h3>
        <div className={styles.breakdownGrid}>
          {[
            [t('usage_stats.cached_tokens'), stats.cached.toLocaleString()],
            [t('monitor_custom.cache_write'), stats.cacheCreation.toLocaleString()],
            [
              t('monitor_custom.weighted_cache_hit'),
              stats.cacheHitRatio === null ? '--' : `${(stats.cacheHitRatio * 100).toFixed(1)}%`,
            ],
            [t('monitor_custom.context_sum'), stats.contextTokens.toLocaleString()],
          ].map(([label, value]) => (
            <div key={label}>
              <div className={styles.statLabel}>{label}</div>
              <strong>{loading ? '--' : value}</strong>
            </div>
          ))}
        </div>
        <p className={styles.cardHint}>{t('monitor_custom.cache_summary_hint')}</p>
      </div>
      <p className={styles.cardHint}>
        {t('monitor_custom.metrics_hint', { count: stats.ttftSamples })}
      </p>
    </section>
  );
}
