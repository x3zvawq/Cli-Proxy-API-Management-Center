import { useTranslation } from 'react-i18next';
import { HoverDetails } from '@/components/ui/HoverDetails';
import { IconInfo } from '@/components/ui/icons';
import type { ProjectedRequest } from './api';
import {
  costFields,
  tokenFields,
  timingFields,
  pickFields,
  type RequestColumn,
} from './requestColumns';
import { RequestTokens, RequestCost, RequestTiming, RequestTransport } from './RequestMetrics';
import styles from './QolPage.module.scss';
import metricStyles from './RequestMetrics.module.scss';

export function RequestCell({
  column,
  row: r,
  names,
  keyLabel,
}: {
  column: RequestColumn;
  row: ProjectedRequest;
  names: Map<string, string>;
  keyLabel: (id: string, stored: string) => string;
}) {
  const { t } = useTranslation();
  switch (column) {
    case 'time':
      return r.timestamp ? (
        <>
          <strong>{new Date(r.timestamp).toLocaleTimeString()}</strong>
          <small>{new Date(r.timestamp).toLocaleDateString()}</small>
        </>
      ) : (
        '—'
      );
    case 'model':
      return (
        <>
          <strong>{r.model || '—'}</strong>
          <small>
            {r.executor !== undefined && <RequestTransport row={{ executor: r.executor }} />}
          </small>
        </>
      );
    case 'key':
      return r.key !== undefined ? keyLabel(r.key, r.key_label || '—') : '—';
    case 'tokens': {
      const row = pickFields(r, tokenFields);
      return row ? <RequestTokens row={row} /> : '—';
    }
    case 'cost': {
      const row = pickFields(r, costFields);
      return row ? <RequestCost row={row} /> : '—';
    }
    case 'timing': {
      const row = pickFields(r, timingFields);
      return row ? <RequestTiming row={row} /> : '—';
    }
    case 'accounts':
      return r.account ? names.get(r.account) || r.account : '—';
    case 'result':
      return r.failed === undefined ? (
        '—'
      ) : (
        <span className={r.failed ? styles.failedBadge : styles.successBadge}>
          {t(r.failed ? 'qol.failed' : 'qol.success')}
        </span>
      );
    case 'request_id':
      return <span className={styles.metadataText}>{r.id}</span>;
    case 'raw_tokens':
      return r.raw_tokens ? (
        <HoverDetails
          label={t('qol.raw_tokens')}
          className={metricStyles.costTrigger}
          triggerContent={
            <>
              {t('qol.raw_tokens')} <IconInfo size={13} />
            </>
          }
        >
          <dl>
            {Object.entries(r.raw_tokens).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        </HoverDetails>
      ) : (
        '—'
      );
    case 'failure_body':
      return r.failure_body ? (
        <HoverDetails
          label={t('qol.failure_body')}
          className={metricStyles.costTrigger}
          triggerContent={
            <>
              {t('qol.failure_body')} <IconInfo size={13} />
            </>
          }
        >
          <pre className={styles.failureBody}>{r.failure_body}</pre>
        </HoverDetails>
      ) : (
        '—'
      );
    default:
      return <span className={styles.metadataText}>{r[column] || '—'}</span>;
  }
}
