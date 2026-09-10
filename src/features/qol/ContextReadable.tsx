import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/Button';
import { IconChevronDown } from '@/components/ui/icons';
import { contextBlocks, type ContextBlock } from './contextBlocks';
import styles from './ContextRecorder.module.scss';
import { ToolPayload } from './ToolPayload';
import { ContextJump } from './ContextJump';

export function ContextReadable({
  body = '',
  items,
  navigation,
  labels,
  inline = false,
}: {
  body?: string;
  items?: ContextBlock[];
  navigation?: ReactNode;
  labels?: string[];
  inline?: boolean;
}) {
  const { t } = useTranslation();
  const blocks = useMemo(() => items ?? contextBlocks(body), [body, items]);
  const [page, setPage] = useState(0);
  const [closed, setClosed] = useState<Set<number>>(() => new Set());
  const [active, setActive] = useState(0);
  const pane = useRef<HTMLDivElement>(null);
  const entries = useRef(new Map<number, HTMLElement>());
  if (!blocks) return <p role="status">{t('qol.context_invalid')}</p>;
  const pages = Math.max(1, Math.ceil(blocks.length / 20));
  const locate = (index: number) => {
    setPage(Math.floor(index / 20));
    setActive(index);
    setClosed((old) => {
      const next = new Set(old);
      next.delete(index);
      return next;
    });
    requestAnimationFrame(() => {
      const element = entries.current.get(index);
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
  return (
    <div className={inline ? styles.inlineReader : styles.readingWorkspace}>
      <nav className={styles.messageNav} aria-label={t('qol.context_message_nav')}>
        {navigation}
        {!inline && (
          <div className={styles.messageActions}>
            <Button size="sm" variant="secondary" onClick={() => setClosed(new Set())}>
              {t('qol.context_expand_all')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setClosed(new Set(blocks.map((_, i) => i)))}
            >
              {t('qol.context_collapse_all')}
            </Button>
          </div>
        )}
        {pages > 1 && (
          <ContextJump
            current={active}
            total={blocks.length}
            onJump={locate}
            label={t('qol.context_jump_block')}
          />
        )}
        {!inline &&
          blocks.slice(page * 20, (page + 1) * 20).map((block, index) => {
            const position = page * 20 + index;
            return (
              <button
                type="button"
                className={styles.navEntry}
                key={position}
                aria-current={active === position ? 'location' : undefined}
                onClick={() => locate(position)}
              >
                <strong>
                  #{labels?.[position] || position + 1} · {block.role} ·{' '}
                  {block.name || t(`qol.context_kind_${block.kind}`)}
                </strong>
                <span>{block.text.slice(0, 100) || block.type}</span>
              </button>
            );
          })}
        {pages > 1 && (
          <div className={styles.pager}>
            <Button size="sm" disabled={!page} onClick={() => locate((page - 1) * 20)}>
              {t('qol.capture_previous')}
            </Button>
            <span>
              {page + 1}/{pages}
            </span>
            <Button size="sm" disabled={page + 1 >= pages} onClick={() => locate((page + 1) * 20)}>
              {t('qol.capture_next')}
            </Button>
          </div>
        )}
      </nav>
      <div
        ref={pane}
        className={styles.readingPane}
        role="region"
        tabIndex={0}
        aria-label={t('qol.capture_body')}
      >
        {blocks.slice(page * 20, (page + 1) * 20).map((block, index) => (
          <div
            key={page * 20 + index}
            ref={(node) => {
              if (node) entries.current.set(page * 20 + index, node);
              else entries.current.delete(page * 20 + index);
            }}
          >
            <ReadableBlock
              block={block}
              index={labels?.[page * 20 + index] || String(page * 20 + index + 1)}
              expanded={!closed.has(page * 20 + index)}
              onToggle={() =>
                setClosed((old) => {
                  const next = new Set(old);
                  if (next.has(page * 20 + index)) next.delete(page * 20 + index);
                  else next.add(page * 20 + index);
                  return next;
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadableBlock({
  block,
  index,
  expanded,
  onToggle,
}: {
  block: ContextBlock;
  index: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const [part, setPart] = useState(0);
  const parts = Math.max(1, Math.ceil(block.text.length / 65536));
  const text = block.text.slice(part * 65536, (part + 1) * 65536);
  const body =
    block.type === 'compaction' || (block.kind === 'reasoning' && !text) ? (
      <p className={styles.note}>{t('qol.context_encrypted')}</p>
    ) : block.kind === 'tool_call' || block.kind === 'tool_result' ? (
      <ToolPayload text={text} result={block.kind === 'tool_result'} />
    ) : block.kind === 'data' ? (
      <pre>{text}</pre>
    ) : block.kind === 'media' ? (
      <p>
        {t('qol.context_media')} {text}
      </p>
    ) : (
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={['img']}
        urlTransform={(url) => (/^https?:\/\//i.test(url) ? url : '')}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    );
  return (
    <article className={styles.block} data-role={block.role}>
      <button
        type="button"
        className={styles.messageHeading}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <IconChevronDown
          size={14}
          aria-hidden="true"
          style={{ transform: expanded ? undefined : 'rotate(-90deg)' }}
        />
        <span>#{index}</span>
        <strong>{block.role || t('qol.context_unknown_role')}</strong>
        <span>{t(`qol.context_kind_${block.kind}`)}</span>
        <code>{block.type}</code>
        {block.name && <strong>{block.name}</strong>}
      </button>
      {!expanded && (
        <p className={styles.collapsedPreview}>{block.text.slice(0, 180) || block.type}</p>
      )}
      {expanded && (
        <>
          {parts > 1 && (
            <ContextJump
              current={part}
              total={parts}
              onJump={setPart}
              label={t('qol.context_jump_segment')}
            />
          )}
          {(block.name || block.callId) && (
            <div className={styles.blockIdentity}>
              {block.name} {block.callId}
            </div>
          )}
          {block.type === 'tools' ? (
            <details>
              <summary>{t('qol.context_tools')}</summary>
              {body}
            </details>
          ) : (
            body
          )}
          {parts > 1 && (
            <div className={styles.pager}>
              <Button
                size="sm"
                variant="secondary"
                disabled={!part}
                onClick={() => setPart(part - 1)}
              >
                {t('qol.capture_previous')}
              </Button>
              <span>{t('qol.context_segment', { current: part + 1, total: parts })}</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={part + 1 >= parts}
                onClick={() => setPart(part + 1)}
              >
                {t('qol.capture_next')}
              </Button>
            </div>
          )}
        </>
      )}
    </article>
  );
}
