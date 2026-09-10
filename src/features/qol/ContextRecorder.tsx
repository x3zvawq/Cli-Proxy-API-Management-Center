import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Modal } from '@/components/ui/Modal';
import {
  qolApi,
  type ContextStatus,
  type ContextPage,
  type ContextBody,
  type ContextRecord,
  type Filters,
} from './api';
import { contextText, retentionSteps, storageSize } from './contextDisplay';
import styles from './ContextRecorder.module.scss';
import { ContextReadable } from './ContextReadable';
import { ConversationBrowser } from './ConversationBrowser';

export function ContextRecorder({
  filters,
  groupId,
  onCloseGroup,
}: {
  filters: Filters;
  groupId?: string;
  onCloseGroup: () => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ContextStatus | null>(null);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    let reading = false;
    const read = async () => {
      if (document.hidden || pending.current || reading) return;
      reading = true;
      const started = generation.current;
      try {
        const next = await qolApi.contextStatus(abort.signal);
        if (!abort.signal.aborted && !pending.current && started === generation.current)
          setStatus(next);
      } catch (e) {
        if (!abort.signal.aborted) setError(String(e));
      } finally {
        reading = false;
      }
    };
    void read();
    const timer = window.setInterval(() => void read(), 15000);
    return () => {
      abort.abort();
      window.clearInterval(timer);
    };
  }, []);
  const savedHours = status?.retention_hours;
  useEffect(() => {
    if (savedHours !== undefined) setHours(savedHours);
  }, [savedHours]);

  const save = async (enabled: boolean, retention: number) => {
    const signal = controller.current?.signal;
    if (
      !signal ||
      pending.current ||
      (status?.enabled === enabled && status.retention_hours === retention)
    )
      return;
    pending.current = true;
    generation.current += 1;
    setBusy(true);
    setError('');
    try {
      const next = await qolApi.saveContextSettings(
        { enabled, retention_hours: retention },
        signal
      );
      if (!signal.aborted) {
        setStatus(next);
        setHours(next.retention_hours);
      }
    } catch (e) {
      if (!signal.aborted) {
        setError(String(e));
        setHours(status?.retention_hours ?? 24);
      }
    } finally {
      pending.current = false;
      if (!signal.aborted) setBusy(false);
    }
  };
  const duration =
    hours >= 24
      ? t('qol.capture_days', { count: hours / 24 })
      : t('qol.capture_hours', { count: hours });
  return (
    <div className={styles.toolbar}>
      <Button size="sm" variant="secondary" onClick={() => setSettingsOpen(true)}>
        {t('qol.context_control', {
          state: status ? t(status.enabled ? 'qol.context_on' : 'qol.context_off') : '…',
        })}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={!status}
        onClick={() => {
          setRevision((v) => v + 1);
          setOpen(true);
        }}
      >
        {t('qol.capture_browse')}
      </Button>
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={t('qol.capture_title')}
        width={620}
      >
        <section className={styles.recorder} aria-label={t('qol.capture_title')} aria-busy={busy}>
          <div className={styles.controls}>
            <ToggleSwitch
              checked={status?.enabled ?? false}
              disabled={!status || busy}
              label={t('qol.capture_title')}
              onChange={(enabled) => void save(enabled, hours)}
            />
            <label className={styles.retention}>
              <span>
                {t('qol.capture_retention')} <strong>{duration}</strong>
              </span>
              <input
                type="range"
                min={0}
                max={retentionSteps.length - 1}
                step={1}
                value={Math.max(0, retentionSteps.indexOf(hours))}
                disabled={!status || busy}
                aria-valuetext={duration}
                onChange={(e) => setHours(retentionSteps[Number(e.target.value)])}
                onPointerUp={() => void save(status?.enabled ?? false, hours)}
                onKeyUp={(e) => {
                  if (
                    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(
                      e.key
                    )
                  )
                    void save(status?.enabled ?? false, hours);
                }}
                onBlur={() => void save(status?.enabled ?? false, hours)}
              />
            </label>
            <span className={styles.space} title={t('qol.capture_disk_help')}>
              {t('qol.capture_disk', { size: storageSize(status?.disk_bytes ?? 0) })}
              <small>
                {t('qol.capture_stored', {
                  count: status?.records ?? 0,
                  size: storageSize(status?.stored_bytes ?? 0),
                })}
              </small>
            </span>
          </div>
          <p className={styles.note}>
            {t('qol.capture_help', { size: storageSize(status?.limit_bytes ?? 1073741824) })}
          </p>
          {!!status && (status.dropped > 0 || status.write_errors > 0) && (
            <p role="status">
              {t('qol.capture_dropped', { dropped: status.dropped, errors: status.write_errors })}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </section>
      </Modal>
      <Modal
        open={open || !!groupId}
        onClose={() => {
          setOpen(false);
          onCloseGroup();
        }}
        title={t(groupId ? 'qol.context_conversation' : 'qol.capture_browse')}
        width={1100}
      >
        {(open || groupId) && (
          <ConversationBrowser
            key={`${revision}:${groupId || ''}`}
            filters={filters}
            groupId={groupId}
            snapshots={<ContextBrowser filters={filters} groupId={groupId} />}
          />
        )}
      </Modal>
    </div>
  );
}

function ContextBrowser({ filters, groupId }: { filters: Filters; groupId?: string }) {
  const { t } = useTranslation();
  // Monitor polling must not reset the open body or the user's context list.
  const [range] = useState(() => ({
    start: filters.start,
    end: filters.end,
    model: filters.model,
  }));
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ContextPage | null>(null);
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setData(null);
    setError('');
    setId('');
    void qolApi
      .contexts({ ...(groupId ? { group_id: groupId } : range), page, page_size: 20 }, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, [range, page, groupId]);
  return (
    <>
      <p className={styles.note}>
        {t(groupId ? 'qol.context_group_help' : 'qol.capture_filter_help')}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className={styles.browser}>
        <div className={styles.list} aria-busy={!data && !error}>
          {data?.items.map((item) => (
            <button
              type="button"
              key={item.id}
              className={styles.record}
              aria-pressed={id === item.id}
              onClick={() => setId(item.id)}
            >
              <strong>
                {item.key_label || t('qol.context_unknown_key')} · {item.model}
              </strong>
              <span>{new Date(item.timestamp).toLocaleString()}</span>
              <span>
                {item.format} · {item.stream ? t('qol.capture_stream') : t('qol.capture_nonstream')}{' '}
                · {storageSize(item.stored_bytes)}
              </span>
              {item.session && <small title={item.session}>{item.session}</small>}
              {item.truncated && <small>{t('qol.capture_truncated')}</small>}
            </button>
          ))}
          {data?.total === 0 && <p>{t('qol.capture_empty')}</p>}
          <div className={styles.pager}>
            <Button
              size="sm"
              variant="secondary"
              disabled={page === 1 || !data}
              onClick={() => setPage(page - 1)}
              aria-label={t('qol.capture_previous')}
            >
              ‹
            </Button>
            <span>
              {page} / {Math.max(1, Math.ceil((data?.total ?? 0) / 20))}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={!data || page * 20 >= data.total}
              onClick={() => setPage(page + 1)}
              aria-label={t('qol.capture_next')}
            >
              ›
            </Button>
          </div>
        </div>
        {id ? (
          <ContextContent key={id} id={id} record={data?.items.find((item) => item.id === id)} />
        ) : (
          <p className={styles.note}>{t('qol.capture_select')}</p>
        )}
      </div>
    </>
  );
}

function ContextContent({ id, record }: { id: string; record?: ContextRecord }) {
  const { t } = useTranslation();
  const [data, setData] = useState<ContextBody | null>(null);
  const [error, setError] = useState('');
  const [part, setPart] = useState(0);
  const [readable, setReadable] = useState(true);
  useEffect(() => {
    const abort = new AbortController();
    void qolApi
      .contextBody(id, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, [id]);
  const text = useMemo(() => contextText(data?.body ?? ''), [data?.body]);
  const parts = Math.max(1, Math.ceil(text.length / 65536));
  return (
    <div className={styles.content} aria-busy={!data && !error}>
      {error && <p role="alert">{error}</p>}
      {data?.truncated && <p role="status">{t('qol.capture_truncated')}</p>}
      <div className={styles.viewerHeading}>
        <div role="radiogroup" aria-label={t('qol.context_view_mode')}>
          <label>
            <input type="radio" checked={readable} onChange={() => setReadable(true)} />
            {t('qol.context_readable')}
          </label>
          <label>
            <input type="radio" checked={!readable} onChange={() => setReadable(false)} />
            JSON
          </label>
        </div>
        <details>
          <summary>{t('qol.context_client')}</summary>
          <p>{record?.client.user_agent || t('qol.context_not_reported')}</p>
          <p>Originator: {record?.client.originator || '—'}</p>
          <p title={record?.client.device_hash}>
            {t('qol.context_device')}:{' '}
            {record?.client.device_hash?.slice(0, 16) || t('qol.context_not_reported')}{' '}
            {record?.client.device_source}
          </p>
          <p className={styles.note}>{t('qol.context_device_help')}</p>
        </details>
      </div>
      {readable && data ? (
        <ContextReadable body={data.body} />
      ) : (
        <>
          <pre role="region" tabIndex={0} aria-label={t('qol.capture_body')}>
            {text.slice(part * 65536, (part + 1) * 65536)}
          </pre>
          {parts > 1 && (
            <div className={styles.pager}>
              <Button
                size="sm"
                variant="secondary"
                disabled={part === 0}
                onClick={() => setPart(part - 1)}
                aria-label={t('qol.capture_previous')}
              >
                ‹
              </Button>
              <span>
                {part + 1} / {parts}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={part + 1 === parts}
                onClick={() => setPart(part + 1)}
                aria-label={t('qol.capture_next')}
              >
                ›
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
