import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconChevronDown } from '@/components/ui/icons';
import { qolApi, type ConversationDirectory, type ConversationDetail } from './api';
import { conversationCategories, filterConversationItems } from './conversationDirectory';
import { ContextJump } from './ContextJump';
import { ContextReadable } from './ContextReadable';
import { contextBlocks } from './contextBlocks';
import styles from './ContextRecorder.module.scss';

export function ConversationItems({ id }: { id: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<ConversationDirectory | null>(null);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState(conversationCategories);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [cache, setCache] = useState<Map<string, ConversationDetail>>(() => new Map());
  const [active, setActive] = useState('');
  const pane = useRef<HTMLDivElement>(null);
  const entries = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    const abort = new AbortController();
    void qolApi
      .conversationIndex(id, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, [id]);
  const save = useCallback(
    (detail: ConversationDetail) => setCache((old) => new Map(old).set(detail.id, detail)),
    []
  );
  const filtered = useMemo(
    () => filterConversationItems(data?.items ?? [], categories, query),
    [data, categories, query]
  );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1));
  const visible = filtered.slice(currentPage * 20, currentPage * 20 + 20);
  const locate = (index: number) => {
    const item = filtered[index];
    if (!item) return;
    setPage(Math.floor(index / 20));
    setActive(item.id);
    requestAnimationFrame(() => {
      const element = entries.current.get(item.id);
      const container = pane.current;
      if (!element || !container) return;
      container.scrollTo({
        top:
          container.scrollTop +
          element.getBoundingClientRect().top -
          container.getBoundingClientRect().top,
      });
      element.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    });
  };
  const toggle = (item: string) =>
    setExpanded((old) => {
      const next = new Set(old);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  return (
    <div className={styles.content} aria-busy={!data && !error}>
      {error && <p role="alert">{error}</p>}
      {!data && !error && (
        <p role="status" className={styles.loading}>
          {t('qol.context_loading')}
        </p>
      )}
      {data && (
        <>
          <p className={styles.note}>
            {t('qol.context_timeline_count', { count: data.requests, items: data.total })} ·{' '}
            {t('qol.context_lazy_hint')}
          </p>
          {data.order_conflict && <p role="status">{t('qol.context_order_conflict')}</p>}
          <div className={styles.readingWorkspace}>
            <nav className={styles.messageNav} aria-label={t('qol.context_message_nav')}>
              <fieldset className={styles.categoryFilters}>
                <legend>{t('qol.context_filter_types')}</legend>
                {conversationCategories.map((category) => (
                  <label key={category}>
                    <input
                      type="checkbox"
                      checked={categories.includes(category)}
                      onChange={(e) => {
                        setCategories((old) =>
                          e.target.checked ? [...old, category] : old.filter((x) => x !== category)
                        );
                        setPage(0);
                      }}
                    />
                    {t(`qol.context_category_${category}`)}
                  </label>
                ))}
              </fieldset>
              <label className={styles.directorySearch}>
                {t('qol.context_search_summary')}
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <ContextJump
                current={currentPage * 20}
                total={filtered.length}
                onJump={locate}
                label={t('qol.context_jump_filtered')}
              />
              <div className={styles.pager}>
                <Button
                  size="sm"
                  disabled={!currentPage}
                  onClick={() => locate((currentPage - 1) * 20)}
                >
                  {t('qol.capture_previous')}
                </Button>
                <span>
                  {currentPage + 1}/{Math.max(1, Math.ceil(filtered.length / 20))}
                </span>
                <Button
                  size="sm"
                  disabled={(currentPage + 1) * 20 >= filtered.length}
                  onClick={() => locate((currentPage + 1) * 20)}
                >
                  {t('qol.capture_next')}
                </Button>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setExpanded(new Set())}>
                {t('qol.context_collapse_all')}
              </Button>
              {visible.map((item, index) => (
                <button
                  type="button"
                  className={styles.navEntry}
                  key={item.id}
                  aria-current={active === item.id ? 'location' : undefined}
                  onClick={() => locate(currentPage * 20 + index)}
                >
                  <strong>
                    #{item.position} · {item.label || item.role || item.type}
                  </strong>
                  <span>{item.preview || item.type}</span>
                </button>
              ))}
            </nav>
            <div
              className={styles.readingPane}
              ref={pane}
              role="region"
              tabIndex={0}
              aria-label={t('qol.capture_body')}
            >
              {filtered.length === 0 && <p>{t('qol.context_no_matching')}</p>}
              {visible.map((item) => (
                <article
                  className={styles.block}
                  data-role={item.role}
                  key={item.id}
                  ref={(node) => {
                    if (node) entries.current.set(item.id, node);
                    else entries.current.delete(item.id);
                  }}
                >
                  <button
                    type="button"
                    className={styles.messageHeading}
                    aria-expanded={expanded.has(item.id)}
                    onClick={() => toggle(item.id)}
                  >
                    <IconChevronDown
                      size={14}
                      aria-hidden="true"
                      style={{ transform: expanded.has(item.id) ? undefined : 'rotate(-90deg)' }}
                    />
                    <strong>
                      #{item.position} · {item.role || item.type}
                    </strong>
                    <span>{item.label || item.type}</span>
                  </button>
                  {!expanded.has(item.id) && (
                    <p className={styles.collapsedPreview}>{item.preview || item.type}</p>
                  )}
                  {expanded.has(item.id) && (
                    <MessageBody
                      key={item.id}
                      conversation={id}
                      item={item.id}
                      cached={cache.get(item.id)}
                      onLoaded={save}
                    />
                  )}
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MessageBody({
  conversation,
  item,
  cached,
  onLoaded,
}: {
  conversation: string;
  item: string;
  cached?: ConversationDetail;
  onLoaded: (item: ConversationDetail) => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  useEffect(() => {
    if (cached) return;
    const abort = new AbortController();
    void qolApi
      .conversationItem(conversation, item, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) onLoaded(value);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, [conversation, item, cached, onLoaded]);
  const blocks = useMemo(() => {
    if (!cached) return [];
    const value = ['input', 'messages', 'contents'].includes(cached.field)
      ? [cached.value]
      : cached.value;
    return contextBlocks(JSON.stringify({ [cached.field]: value })) ?? [];
  }, [cached]);
  if (error) return <p role="alert">{error}</p>;
  if (!cached)
    return (
      <p role="status" className={styles.loading}>
        {t('qol.context_message_loading')}
      </p>
    );
  return <ContextReadable items={blocks} inline />;
}
