import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { IconNetwork } from '@/components/ui/icons';
import { qolApi, type Account, type ProbeResult } from './api';
import { accountLabel } from './display';
import { ContextReadable } from './ContextReadable';
import { candyPrompt, pelicanPrompt, pelicanDocument, nonNavigatingPreview } from './probePresets';
import quotaStyles from './AccountQuota.module.scss';
import styles from './AccountProbe.module.scss';

export function AccountProbe({ account }: { account: Account }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if ((account.provider || account.type) !== 'codex') return null;
  return (
    <>
      <button type="button" className={quotaStyles.textButton} onClick={() => setOpen(true)}>
        <IconNetwork size={13} />
        {t('qol.probe_title')}
      </button>
      <Modal
        open={open}
        title={`${t('qol.probe_title')} · ${accountLabel(account)}`}
        width={900}
        onClose={() => setOpen(false)}
      >
        {open && <ProbeForm account={account} />}
      </Modal>
    </>
  );
}

function ProbeForm({ account }: { account: Account }) {
  const { t } = useTranslation();
  const modelList = useId();
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('high');
  const [preset, setPreset] = useState('custom');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('readable');
  const active = useRef<string | null>(null);
  const mounted = useRef(true);
  const poll = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    void qolApi
      .models(abort.signal)
      .then(setModels)
      .catch(() => {});
    return () => {
      mounted.current = false;
      abort.abort();
      poll.current?.abort();
      if (active.current) void qolApi.cancelProbe(active.current).catch(() => {});
    };
  }, []);
  const start = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    setView('readable');
    const controller = new AbortController();
    poll.current = controller;
    try {
      const job = await qolApi.startProbe({
        account: account.auth_index,
        model: model.trim(),
        effort,
        prompt,
      });
      if (!mounted.current) {
        await qolApi.cancelProbe(job.id);
        return;
      }
      active.current = job.id;
      while (!controller.signal.aborted) {
        const next = await qolApi.probe(job.id, controller.signal);
        if (!mounted.current) return;
        setResult(next);
        if (next.status !== 'running') {
          active.current = null;
          break;
        }
        await new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timer);
            controller.signal.removeEventListener('abort', done);
            resolve();
          };
          const timer = setTimeout(done, 1000);
          controller.signal.addEventListener('abort', done, { once: true });
        });
      }
    } catch (e) {
      if (mounted.current && !controller.signal.aborted)
        setError(e instanceof Error ? e.message : String(e));
      if (active.current) void qolApi.cancelProbe(active.current).catch(() => {});
      active.current = null;
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const cancel = async () => {
    if (!active.current) return;
    try {
      await qolApi.cancelProbe(active.current);
    } catch (e) {
      setError(String(e));
    }
  };
  const html = result?.status === 'completed' ? pelicanDocument(result.text) : null;
  const preview = useMemo(() => (html ? nonNavigatingPreview(html) : undefined), [html]);
  return (
    <div className={styles.form}>
      <p className={styles.note}>{t('qol.probe_hint')}</p>
      {account.disabled && <p className={styles.note}>{t('qol.probe_disabled_hint')}</p>}
      <div className={styles.fields}>
        <label>
          {t('qol.model')}
          <input
            className="input"
            list={modelList}
            value={model}
            maxLength={120}
            disabled={busy}
            onChange={(e) => setModel(e.target.value)}
            placeholder={t('qol.probe_model_hint')}
          />
          <datalist id={modelList}>
            {models.map((m) => (
              <option value={m} key={m} />
            ))}
          </datalist>
        </label>
        <label>
          {t('qol.thinking')}
          <select
            className="input"
            value={effort}
            disabled={busy}
            onChange={(e) => setEffort(e.target.value)}
          >
            {['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.presets} role="radiogroup" aria-label={t('qol.probe_preset')}>
        {['custom', 'candy', 'pelican'].map((p) => (
          <label key={p}>
            <input
              type="radio"
              name={modelList + 'preset'}
              value={p}
              checked={preset === p}
              disabled={busy}
              onChange={() => {
                setPreset(p);
                setPrompt(p === 'candy' ? candyPrompt : p === 'pelican' ? pelicanPrompt : '');
              }}
            />
            {t(`qol.probe_${p}`)}
          </label>
        ))}
      </div>
      <label>
        {t('qol.probe_prompt')}
        <textarea
          className="input"
          value={prompt}
          disabled={busy}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={20000}
        />
      </label>
      <div className={styles.actions}>
        <Button
          size="sm"
          loading={busy}
          disabled={
            !model.trim() || !prompt.trim() || new TextEncoder().encode(prompt).length > 20000
          }
          onClick={() => void start()}
        >
          {t('qol.probe_start')}
        </Button>
        {busy && (
          <Button size="sm" variant="secondary" disabled={!result} onClick={() => void cancel()}>
            {t('qol.probe_cancel')}
          </Button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div className={styles.result}>
          <div className={styles.metrics} role="status">
            <strong>{t(`qol.probe_status_${result.status}`)}</strong>
            <span>HTTP {result.http_status || '—'}</span>
            <span>
              {t('qol.probe_elapsed')} {(result.elapsed_ms / 1000).toFixed(1)}s
            </span>
            <span>
              TTFT {result.ttft_ms === null ? '—' : (result.ttft_ms / 1000).toFixed(2) + 's'}
            </span>
          </div>
          {result.response_model && (
            <p className={styles.note}>
              {t('qol.probe_reported_model')}: {result.response_model}
            </p>
          )}
          {result.usage && (
            <p className={styles.note}>
              {t('qol.tokens')}: {t('qol.probe_input')} {result.usage.input_tokens ?? '—'} ·{' '}
              {t('qol.output')} {result.usage.output_tokens ?? '—'} · {t('qol.reasoning')}{' '}
              {result.usage.output_tokens_details?.reasoning_tokens ?? '—'}
            </p>
          )}
          {result.error && (
            <p role="alert">
              {result.category}: {result.error}
            </p>
          )}
          {result.text && (
            <>
              <div className={styles.presets} role="radiogroup" aria-label={t('qol.probe_view')}>
                {['readable', 'source', ...(html ? ['preview'] : [])].map((v) => (
                  <label key={v}>
                    <input
                      type="radio"
                      name={modelList + 'view'}
                      checked={view === v}
                      onChange={() => setView(v)}
                    />
                    {t(`qol.probe_view_${v}`)}
                  </label>
                ))}
              </div>
              {view === 'source' ? (
                <pre className={styles.source}>{result.text}</pre>
              ) : view === 'preview' && html ? (
                <>
                  <p className={styles.note}>{t('qol.probe_preview_hint')}</p>
                  <iframe
                    title={t('qol.probe_view_preview')}
                    className={styles.preview}
                    sandbox=""
                    referrerPolicy="no-referrer"
                    srcDoc={preview}
                  />
                </>
              ) : (
                <ContextReadable
                  inline
                  body={JSON.stringify({ messages: [{ role: 'assistant', content: result.text }] })}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
