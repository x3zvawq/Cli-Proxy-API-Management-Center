import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/Button';
import { contextBlocks, type ContextBlock } from './contextBlocks';
import styles from './ContextRecorder.module.scss';
import { ToolPayload } from './ToolPayload';

export function ContextReadable({ body = '', items }: { body?: string; items?: ContextBlock[] }) {
  const { t } = useTranslation();
  const blocks = useMemo(() => items ?? contextBlocks(body), [body, items]);
  const [page, setPage] = useState(0);
  if (!blocks) return <p role="status">{t('qol.context_invalid')}</p>;
  const pages = Math.max(1, Math.ceil(blocks.length / 20));
  return (
    <div className={styles.readable} role="region" tabIndex={0} aria-label={t('qol.capture_body')}>
      {blocks.slice(page * 20, (page + 1) * 20).map((block, index) => (
        <ReadableBlock key={page * 20 + index} block={block} index={page * 20 + index + 1} />
      ))}
      {pages > 1 && (
        <div className={styles.pager}>
          <Button size="sm" variant="secondary" disabled={!page} onClick={() => setPage(page - 1)}>
            {t('qol.capture_previous')}
          </Button>
          <span>
            {page + 1} / {pages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page + 1 >= pages}
            onClick={() => setPage(page + 1)}
          >
            {t('qol.capture_next')}
          </Button>
        </div>
      )}
    </div>
  );
}

function ReadableBlock({ block, index }: { block: ContextBlock; index: number }) {
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
      <header>
        <span>#{index}</span>
        <strong>{block.role || t('qol.context_unknown_role')}</strong>
        <span>{t(`qol.context_kind_${block.kind}`)}</span>
        <code>{block.type}</code>
      </header>
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
          <Button size="sm" variant="secondary" disabled={!part} onClick={() => setPart(part - 1)}>
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
    </article>
  );
}
