import { useTranslation } from 'react-i18next';
import { HoverDetails } from '@/components/ui/HoverDetails';
import { IconInfo } from '@/components/ui/icons';
import { requestUpstreamTransport } from '@/utils/requestPresentation';
import type { RequestRow } from './api';
import { formatTokens } from './display';
import { useQolPriceStore } from './priceStore';
import { compactMoney, requestCostParts, requestTiming } from './metricFormatting';
import styles from './RequestMetrics.module.scss';
import { costFields, tokenFields, timingFields } from './requestColumns';

export function RequestTransport({ row }: { row: Pick<RequestRow, 'executor'> }) {
  const { t } = useTranslation();
  const transport = requestUpstreamTransport(row.executor);
  return (
    <span
      className={styles.transport}
      title={t('monitor_custom.transport_hint') + ' ' + row.executor}
    >
      {t('qol.upstream_transport')} {transport || '—'}
    </span>
  );
}

export function RequestTokens({ row }: { row: Pick<RequestRow, (typeof tokenFields)[number]> }) {
  const { t } = useTranslation();
  return (
    <HoverDetails
      label={t('monitor_custom.token_details')}
      className={styles.tokenTrigger}
      triggerContent={
        <>
          <span>
            ↑ {formatTokens(row.context)} / ↓ {formatTokens(row.output)}
          </span>
          <small>
            {t('qol.context')} {formatTokens(row.context)} <IconInfo size={13} />
          </small>
        </>
      }
    >
      <strong>{t('monitor_custom.token_details')}</strong>
      <dl>
        {(
          ['input', 'output', 'reasoning', 'cache_read', 'cache_write', 'context', 'total'] as const
        ).map((key) => (
          <div key={key}>
            <dt>{t('qol.' + key)}</dt>
            <dd>{row[key].toLocaleString()}</dd>
          </div>
        ))}
        <div>
          <dt>{t('qol.cache_hit')}</dt>
          <dd>{row.context ? ((row.cache_read / row.context) * 100).toFixed(1) + '%' : '—'}</dd>
        </div>
      </dl>
      <p>{t('qol.token_accounting')}</p>
    </HoverDetails>
  );
}

export function RequestCost({ row }: { row: Pick<RequestRow, (typeof costFields)[number]> }) {
  const { t } = useTranslation();
  const prices = useQolPriceStore((state) => state.prices);
  const details = requestCostParts(row, prices);
  return (
    <HoverDetails
      label={t('qol.cost_details')}
      className={styles.costTrigger}
      triggerContent={
        <>
          {compactMoney(row.cost)} <IconInfo size={12} />
        </>
      }
    >
      <strong>{t('qol.cost_details')}</strong>
      <dl>
        <div>
          <dt>{t('qol.cost')}</dt>
          <dd>{row.cost === null ? '—' : '$' + row.cost.toFixed(8)}</dd>
        </div>
        {details?.matches &&
          details.parts.map((part) => (
            <div key={part.key}>
              <dt>
                {t('qol.' + part.key)}
                <small className={styles.formula}>
                  {part.tokens.toLocaleString()} × {'$' + part.rate}/M
                </small>
              </dt>
              <dd>{'$' + part.cost.toFixed(8)}</dd>
            </div>
          ))}
        {details?.matches && (
          <div>
            <dt>{t('qol.price_multiplier')}</dt>
            <dd>×{details.multiplier}</dd>
          </div>
        )}
      </dl>
      <p>{details?.matches ? t('qol.cost_accounting') : t('qol.cost_unavailable')}</p>
    </HoverDetails>
  );
}

export function RequestTiming({ row }: { row: Pick<RequestRow, (typeof timingFields)[number]> }) {
  const { t } = useTranslation();
  const values = requestTiming(row);
  return (
    <div className={styles.timing} title={t('qol.timing_hint')}>
      <span>
        <em>{t('qol.first_token')}</em>
        <b>{values.first === null ? '—' : values.first.toFixed(2) + 's'}</b>
      </span>
      <span>
        <em>{t('qol.generation')}</em>
        <b>{values.generation === null ? '—' : values.generation.toFixed(2) + 's'}</b>
      </span>
      <span>
        <em>TPS</em>
        <b>{values.tps === null ? '—' : values.tps.toFixed(1)}</b>
      </span>
    </div>
  );
}
