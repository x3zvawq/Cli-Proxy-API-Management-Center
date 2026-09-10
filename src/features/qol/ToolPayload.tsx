import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ContextRecorder.module.scss';

function parse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

// Render structured tool arguments/results as fields, not a JSON envelope.
// Unknown properties remain visible. Raw protocol JSON is available separately.
export function ToolPayload({ text, result }: { text: string; result: boolean }) {
  const { t } = useTranslation();
  const value = useMemo(() => parse(text), [text]);
  return (
    <section
      className={styles.toolPayload}
      aria-label={t(result ? 'qol.context_tool_output' : 'qol.context_tool_input')}
    >
      <div className={styles.toolLabel}>
        {t(result ? 'qol.context_tool_output' : 'qol.context_tool_input')}
      </div>
      <ToolValue value={value} result={result} depth={0} />
    </section>
  );
}

function ToolValue({ value, result, depth }: { value: unknown; result: boolean; depth: number }) {
  if (value === null || typeof value === 'number' || typeof value === 'boolean')
    return <code>{String(value)}</code>;
  if (typeof value === 'string') {
    const decoded = result ? parse(value) : value;
    if (decoded !== value && depth < 6)
      return <ToolValue value={decoded} result={result} depth={depth + 1} />;
    return result ? (
      <div className={styles.toolText}>
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
          {value}
        </Markdown>
      </div>
    ) : (
      <pre>
        <code>{value}</code>
      </pre>
    );
  }
  if (depth >= 6) return <pre>{JSON.stringify(value, null, 2)}</pre>;
  if (Array.isArray(value))
    return (
      <div>
        {value.map((item, i) => (
          <div className={styles.toolItem} key={i}>
            <ToolValue value={item} result={result} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  if (typeof value === 'object' && value) {
    const entries = Object.entries(value);
    return (
      <dl className={styles.toolFields}>
        {entries.map(([key, item]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>
              <ToolValue value={item} result={result && key !== 'type'} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return null;
}
