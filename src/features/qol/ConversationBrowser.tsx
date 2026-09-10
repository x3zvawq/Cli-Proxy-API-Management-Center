import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { qolApi, type ConversationPage, type ConversationRecord, type Filters } from './api';
import { ContextReadable } from './ContextReadable';
import { contextBlocks } from './contextBlocks';
import styles from './ContextRecorder.module.scss';
import { ContextJump } from './ContextJump';

export function ConversationBrowser({
  filters,
  groupId,
  snapshots,
}: {
  filters: Filters;
  groupId?: string;
  snapshots: ReactNode;
}) {
  const { t } = useTranslation();
  const [snapshotMode, setSnapshotMode] = useState(false);
  return (
    <div className={styles.explorer}>
      <div
        className={`${styles.viewerHeading} ${styles.layoutModes}`}
        role="radiogroup"
        aria-label={t('qol.context_layout')}
      >
        <label>
          <input type="radio" checked={!snapshotMode} onChange={() => setSnapshotMode(false)} />
          {t('qol.context_conversation')}
        </label>
        <label>
          <input type="radio" checked={snapshotMode} onChange={() => setSnapshotMode(true)} />
          {t('qol.context_snapshots')}
        </label>
      </div>
      {!snapshotMode && (
        <details className={styles.note}>
          <summary>{t('qol.context_merge_notes')}</summary>
          {t('qol.context_merge_help')}
        </details>
      )}
      {snapshotMode ? (
        snapshots
      ) : groupId ? (
        <ConversationTimeline id={groupId} />
      ) : (
        <ConversationIndex filters={filters} />
      )}
    </div>
  );
}

function ConversationIndex({ filters }: { filters: Filters }) {
  const { t } = useTranslation();
  const [range] = useState(() => ({
    start: filters.start,
    end: filters.end,
    model: filters.model,
  }));
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: ConversationRecord[]; total: number } | null>(null);
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setData(null);
    setError('');
    setId('');
    void qolApi
      .conversations({ ...range, page, page_size: 20 }, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, [range, page]);
  if (id)
    return (
      <div className={styles.viewerSection}>
        <div>
          <Button size="sm" variant="secondary" onClick={() => setId('')}>
            {t('qol.context_back_sessions')}
          </Button>
        </div>
        <ConversationTimeline key={id} id={id} />
      </div>
    );
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <div className={styles.directory}>
        <div className={styles.list} aria-busy={!data && !error}>
          {!data && !error && (
            <p role="status" className={styles.loading}>
              {t('qol.context_loading')}
            </p>
          )}
          {data?.items.map((item) => (
            <button
              type="button"
              className={styles.record}
              key={item.id}
              aria-pressed={id === item.id}
              onClick={() => setId(item.id)}
            >
              <strong>
                {item.key_label || t('qol.context_unknown_key')} · {item.model}
              </strong>
              <span>
                {new Date(item.timestamp).toLocaleString()} ·{' '}
                {t('qol.context_request_count', { count: item.requests })}
              </span>
              <small title={item.session}>{item.session || t('qol.context_no_session')}</small>
            </button>
          ))}
          {data?.total === 0 && <p>{t('qol.capture_empty')}</p>}
          <div className={styles.pager}>
            <Button
              size="sm"
              variant="secondary"
              disabled={page === 1 || !data}
              onClick={() => setPage(page - 1)}
            >
              {t('qol.capture_previous')}
            </Button>
            <span>
              {page} / {Math.max(1, Math.ceil((data?.total ?? 0) / 20))}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={!data || page * 20 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              {t('qol.capture_next')}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function ConversationTimeline({ id }: { id: string }) {
  const { t } = useTranslation();
  const [offsets, setOffsets] = useState([0]);
  const offset = offsets[offsets.length - 1] ?? 0;
  const [data, setData] = useState<ConversationPage | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setData(null);
    setError('');
    void qolApi
      .conversation(id, offset, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, [id, offset]);
  const entries = useMemo(
    () =>
      data?.items.flatMap((item, index) => {
        const value = ['input', 'messages', 'contents'].includes(item.field)
          ? [item.value]
          : item.value;
        const blocks = contextBlocks(JSON.stringify({ [item.field]: value })) ?? [];
        return blocks.map((block, part) => ({
          block,
          label:
            blocks.length > 1 ? `${offset + index + 1}.${part + 1}` : String(offset + index + 1),
        }));
      }) ?? [],
    [data, offset]
  );
  return (
    <div className={styles.content} aria-busy={!data && !error}>
      {!data && !error && (
        <p role="status" className={styles.loading}>
          {t('qol.context_loading')}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p className={styles.note}>
            {t('qol.context_timeline_count', { count: data.requests, items: data.total })}
          </p>
          {data.order_conflict && <p role="status">{t('qol.context_order_conflict')}</p>}
          {data.total === 0 ? (
            <p>{t('qol.capture_empty')}</p>
          ) : (
            <ContextReadable
              key={offset}
              items={entries.map((x) => x.block)}
              labels={entries.map((x) => x.label)}
              navigation={
                <>
                  <ContextJump
                    current={offset}
                    total={data.total}
                    onJump={(target) => setOffsets((old) => [...old, target])}
                  />
                  <div className={styles.pager}>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={offsets.length === 1}
                      onClick={() => setOffsets((old) => old.slice(0, -1))}
                    >
                      {t('qol.capture_previous')}
                    </Button>
                    <span>
                      {Math.min(offset + 1, data.total)}–{data.next_offset}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={data.next_offset >= data.total}
                      onClick={() => setOffsets((old) => [...old, data.next_offset])}
                    >
                      {t('qol.capture_next')}
                    </Button>
                  </div>
                </>
              }
            />
          )}
        </>
      )}
    </div>
  );
}
