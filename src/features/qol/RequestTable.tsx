import { useTranslation } from 'react-i18next';
import type { ProjectedRequest } from './api';
import { RequestCell } from './RequestCell';
import { selectedColumns } from './requestColumns';
import styles from './QolPage.module.scss';
import { Button } from '@/components/ui/Button';

export function RequestTable({
  rows,
  columns: selection,
  names,
  keyLabel,
  onViewContext,
}: {
  rows: ProjectedRequest[];
  columns: string[];
  names: Map<string, string>;
  keyLabel: (id: string, stored: string) => string;
  onViewContext?: (group: string) => void;
}) {
  const { t } = useTranslation();
  const columns = selectedColumns(selection);
  const props = { names, keyLabel };
  return (
    <>
      <div className={styles.requestCards}>
        {rows.map((r) => (
          <details key={r.id}>
            <summary>
              {columns
                .filter((c) => ['model', 'time', 'cost', 'result'].includes(c.id))
                .sort(
                  (a, b) =>
                    ['model', 'cost', 'time', 'result'].indexOf(a.id) -
                    ['model', 'cost', 'time', 'result'].indexOf(b.id)
                )
                .map((c) => (
                  <span key={c.id}>
                    <RequestCell {...props} row={r} column={c.id} />
                  </span>
                ))}
              {!columns.some((c) => ['model', 'time', 'cost', 'result'].includes(c.id)) && (
                <span>{t('qol.request_details')}</span>
              )}
            </summary>
            <dl className={styles.details}>
              {columns
                .filter((c) => !['model', 'time', 'cost', 'result'].includes(c.id))
                .map((c) => (
                  <div key={c.id}>
                    <dt>{t(`qol.${c.id}`)}</dt>
                    <dd>
                      <RequestCell {...props} row={r} column={c.id} />
                    </dd>
                  </div>
                ))}
            </dl>
            <Button
              size="sm"
              variant="ghost"
              disabled={!r.context_group || !onViewContext}
              title={r.context_group ? t('qol.context_group_help') : t('qol.context_no_session')}
              onClick={() => r.context_group && onViewContext?.(r.context_group)}
            >
              {t('qol.context_view')}
            </Button>
          </details>
        ))}
      </div>
      <div className={`${styles.tableWrap} ${styles.desktopRequests}`}>
        <table className={`${styles.table} ${styles.requestTable}`}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.id} className={c.id === 'timing' ? styles.timingColumn : undefined}>
                  {t(`qol.${c.id}`)}
                </th>
              ))}
              <th>{t('qol.context_view')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {columns.map((c) => (
                  <td
                    key={c.id}
                    data-label={t(`qol.${c.id}`)}
                    className={c.id === 'timing' ? styles.timingColumn : undefined}
                  >
                    <RequestCell {...props} row={r} column={c.id} />
                  </td>
                ))}
                <td>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!r.context_group || !onViewContext}
                    title={
                      r.context_group ? t('qol.context_group_help') : t('qol.context_no_session')
                    }
                    onClick={() => r.context_group && onViewContext?.(r.context_group)}
                  >
                    {t('qol.context_view')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
