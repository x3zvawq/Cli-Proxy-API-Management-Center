import { useTranslation } from 'react-i18next';
import type { ProjectedRequest } from './api';
import { RequestCell } from './RequestCell';
import { selectedColumns } from './requestColumns';
import styles from './QolPage.module.scss';

export function RequestTable({
  rows,
  columns: selection,
  names,
  keyLabel,
}: {
  rows: ProjectedRequest[];
  columns: string[];
  names: Map<string, string>;
  keyLabel: (id: string, stored: string) => string;
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
