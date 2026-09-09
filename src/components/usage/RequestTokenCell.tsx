import { HoverDetails } from '@/components/ui/HoverDetails';
import { useTranslation } from 'react-i18next';
import { IconInfo } from '@/components/ui/icons';
import { formatCompactNumber } from '@/utils/usage';
import styles from './RequestTokenCell.module.scss';

export interface RequestTokenMetrics {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  contextTokens: number;
  cacheHitRatio: number | null;
}

export function RequestTokenCell({ metrics }: { metrics: RequestTokenMetrics }) {
  const { t } = useTranslation();
  const details = [
    [t('usage_stats.input_tokens'), metrics.inputTokens.toLocaleString()],
    [t('usage_stats.output_tokens'), metrics.outputTokens.toLocaleString()],
    [t('usage_stats.reasoning_tokens'), metrics.reasoningTokens.toLocaleString()],
    [t('usage_stats.cached_tokens'), metrics.cachedTokens.toLocaleString()],
    [t('monitor_custom.cache_write'), metrics.cacheCreationTokens.toLocaleString()],
    [
      t('usage_stats.cache_hit'),
      metrics.cacheHitRatio === null ? '--' : `${(metrics.cacheHitRatio * 100).toFixed(1)}%`,
    ],
    [t('monitor_custom.context'), metrics.contextTokens.toLocaleString()],
    [t('usage_stats.total_tokens'), metrics.totalTokens.toLocaleString()],
  ];
  return (
    <div className={styles.cell}>
      <div className={styles.summary}>
        <div className={styles.flow}>
          <span title={`${t('usage_stats.input_tokens')}: ${metrics.inputTokens.toLocaleString()}`}>
            ↑ {formatCompactNumber(metrics.inputTokens)}
          </span>
          <span
            title={`${t('usage_stats.output_tokens')}: ${metrics.outputTokens.toLocaleString()}`}
          >
            ↓ {formatCompactNumber(metrics.outputTokens)}
          </span>
        </div>
        <div className={styles.context}>
          {t('monitor_custom.context_short')} {formatCompactNumber(metrics.contextTokens)}
        </div>
      </div>
      <HoverDetails
        label={t('monitor_custom.token_details')}
        triggerContent={<IconInfo size={16} />}
      >
        <strong>{t('monitor_custom.token_details')}</strong>
        <dl>
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p>{t('monitor_custom.context_hint')}</p>
      </HoverDetails>
    </div>
  );
}
