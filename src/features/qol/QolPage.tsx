import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PriceSettingsCard } from '@/components/usage/PriceSettingsCard';
import { useAuthStore, useConfigStore } from '@/stores';
import { authFilesApi } from '@/services/api/authFiles';
import { toLocalDateTime } from '@/utils/monitorAnalytics';
import { loadModelPrices, type ModelPrice } from '@/utils/usage';
import { loadTierMultipliers, type TierMultiplierRule } from '@/utils/tierMultiplier';
import {
  qolApi,
  type Account,
  type Filters,
  type Prices,
  type RequestPage,
  type RequestRow,
  type Summary,
} from './api';
import styles from './QolPage.module.scss';
import { RequestCards } from './RequestCards';
import {
  keyPrefixes,
  quotaOptions,
  quotaWindowId,
  readHiddenQuotas,
  type UsageView,
} from './display';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Tooltip,
  Legend
);
const number = (value: number) => value.toLocaleString();
const money = (value: number | null) => (value === null ? '—' : `$${value.toFixed(5)}`);
const initialRange = () => ({
  start: new Date(Date.now() - 86400000).toISOString(),
  end: new Date().toISOString(),
});

export function UsagePage({ view }: { view: UsageView }) {
  // Remount on connection changes: no old account/key data survives a server switch.
  const base = useAuthStore((s) => s.apiBase);
  const key = useAuthStore((s) => s.managementKey);
  return <UsageWorkspace key={`${base}\0${key}\0${view}`} tab={view} base={base} />;
}

function UsageWorkspace({ tab, base }: { tab: UsageView; base: string }) {
  const { t } = useTranslation();
  const configuredKeys = useConfigStore((state) => state.config?.apiKeys);
  const [prefixes, setPrefixes] = useState<Record<string, string>>({});
  const quotaStorageKey = `cpa-quota-hidden:${base}`;
  const [hiddenQuotas, setHiddenQuotas] = useState(() =>
    readHiddenQuotas(localStorage, quotaStorageKey)
  );
  useEffect(() => {
    let active = true;
    setPrefixes({});
    void keyPrefixes(configuredKeys || [])
      .then((value) => {
        if (active) setPrefixes(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [configuredKeys]);
  const keyLabel = (id: string, stored: string) => prefixes[id] || stored;
  const toggleQuota = (id: string, visible: boolean) => {
    const next = visible ? hiddenQuotas.filter((value) => value !== id) : [...hiddenQuotas, id];
    setHiddenQuotas(next);
    try {
      localStorage.setItem(quotaStorageKey, JSON.stringify(next));
    } catch {
      /* Session preference still works when browser storage is disabled. */
    }
  };
  const [filters, setFilters] = useState<Filters>(initialRange);
  const [relativeRange, setRelativeRange] = useState(true);
  const [draft, setDraft] = useState(() => ({
    start: toLocalDateTime(Date.parse(filters.start)),
    end: toLocalDateTime(Date.parse(filters.end)),
  }));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [keyOptions, setKeyOptions] = useState<{ id: string; label: string }[]>([]);
  const [requests, setRequests] = useState<RequestPage | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [prices, setPrices] = useState<Prices>({});
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<RequestRow | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void qolApi
      .accounts(controller.signal)
      .then(setAccounts)
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    void qolApi
      .prices(controller.signal)
      .then(setPrices)
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (tab !== 'monitor') return;
    const controller = new AbortController();
    setSummary(null);
    void qolApi
      .summary(filters, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setSummary(value);
        setKeyOptions((previous) =>
          Array.from(
            new Map(
              [...previous, ...value.keys].map((key) => [key.id, { id: key.id, label: key.label }])
            ).values()
          ).slice(0, 500)
        );
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [filters, revision, tab]);

  useEffect(() => {
    if (tab !== 'monitor') return;
    const controller = new AbortController();
    setLoading(true);
    setRequests(null);
    setError('');
    void qolApi
      .requests({ ...filters, page, page_size: 50 }, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setRequests(value);
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, page, revision, tab]);

  useEffect(() => {
    if (tab !== 'accounts') return;
    let current: AbortController | undefined;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      current?.abort();
      current = new AbortController();
      const signal = current.signal;
      void qolApi
        .accounts(signal)
        .then((value) => {
          if (!signal.aborted) setAccounts(value);
        })
        .catch(() => {});
    }, 15000);
    return () => {
      clearInterval(timer);
      current?.abort();
    };
  }, [tab]);

  const mutate = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      setRevision((v) => v + 1);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const changeFilter = (field: keyof Filters, value: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [field]: value }));
  };
  const applyRange = () => {
    const start = new Date(draft.start);
    const end = new Date(draft.end);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setError(t('qol.invalid_range'));
      return;
    }
    setPage(1);
    setRelativeRange(false);
    setFilters((f) => ({ ...f, start: start.toISOString(), end: end.toISOString() }));
  };
  const names = useMemo(
    () => new Map(accounts.map((a) => [a.auth_index, a.email || a.name])),
    [accounts]
  );
  const filteredAccounts = accounts.filter((a) =>
    `${a.email} ${a.name} ${a.provider} ${a.quota?.plan || ''}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const rules = Object.entries(prices).flatMap(([model, p]) =>
    Object.entries(p.tierMultipliers || {}).map(([tier, multiplier]) => ({
      model,
      tier,
      multiplier,
    }))
  );
  const savePrices = (next: Record<string, ModelPrice>, nextRules: TierMultiplierRule[] = rules) =>
    mutate(async () => {
      const merged: Prices = Object.fromEntries(
        Object.entries(next).map(([name, p]) => [
          name,
          {
            ...p,
            tierMultipliers: Object.fromEntries(
              nextRules.filter((r) => r.model === name).map((r) => [r.tier, r.multiplier])
            ),
          },
        ])
      );
      setPrices(await qolApi.savePrices(merged));
    });
  const totals = summary?.totals;
  const availableQuotas = quotaOptions(accounts);

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <h1>{t(tab === 'monitor' ? 'nav.monitoring_center' : `qol.${tab}`)}</h1>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            if (relativeRange && tab === 'monitor') {
              const range = initialRange();
              setFilters((f) => ({ ...f, ...range }));
              setDraft({
                start: toLocalDateTime(Date.parse(range.start)),
                end: toLocalDateTime(Date.parse(range.end)),
              });
              setPage(1);
            }
            setRevision((v) => v + 1);
          }}
        >
          {t('qol.refresh')}
        </Button>
      </header>
      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}
      {tab === 'monitor' && (
        <>
          <section className={styles.filters}>
            <label>
              {t('qol.start')}
              <input
                type="datetime-local"
                value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              />
            </label>
            <label>
              {t('qol.end')}
              <input
                type="datetime-local"
                value={draft.end}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              />
            </label>
            <Button onClick={applyRange}>{t('qol.apply')}</Button>
            <Button
              onClick={() => {
                const next = initialRange();
                setRelativeRange(true);
                setFilters(next);
                setDraft({
                  start: toLocalDateTime(Date.parse(next.start)),
                  end: toLocalDateTime(Date.parse(next.end)),
                });
                setPage(1);
              }}
            >
              {t('qol.day')}
            </Button>
            <label>
              {t('qol.key')}
              <select
                value={filters.key || ''}
                onChange={(e) => changeFilter('key', e.target.value)}
              >
                <option value="">{t('qol.all')}</option>
                {keyOptions.map((k) => (
                  <option key={k.id} value={k.id}>
                    {keyLabel(k.id, k.label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('qol.model')}
              <input
                value={filters.model || ''}
                placeholder={t('qol.all')}
                onChange={(e) => changeFilter('model', e.target.value)}
              />
            </label>
            <label>
              {t('qol.accounts')}
              <select
                value={filters.account || ''}
                onChange={(e) => changeFilter('account', e.target.value)}
              >
                <option value="">{t('qol.all')}</option>
                {accounts.map((a) => (
                  <option key={a.auth_index || a.id} value={a.auth_index}>
                    {a.email || a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('qol.result')}
              <select
                value={filters.result || ''}
                onChange={(e) => changeFilter('result', e.target.value)}
              >
                <option value="">{t('qol.all')}</option>
                <option value="success">{t('qol.success')}</option>
                <option value="failed">{t('qol.failed')}</option>
              </select>
            </label>
          </section>
          <section className={styles.stats} aria-busy={!summary}>
            {[
              ['requests', totals ? number(totals.requests) : '—'],
              ['cost', totals?.priced ? money(totals.cost) : '—'],
              ['cache_read', totals ? number(totals.cache_read) : '—'],
              ['cache_write', totals ? number(totals.cache_write) : '—'],
              [
                'cache_hit',
                totals?.context
                  ? `${((totals.cache_read / totals.context) * 100).toFixed(1)}%`
                  : '—',
              ],
              ['ttft', totals?.ttft_ms ? `${(totals.ttft_ms / 1000).toFixed(2)}s` : '—'],
            ].map(([label, value]) => (
              <article key={label}>
                <span>{t(`qol.${label}`)}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>
          <p className={styles.hint}>
            {t('qol.cost_hint', { priced: totals?.priced || 0, total: totals?.requests || 0 })}
          </p>
          <section className={styles.panel}>
            <h2>{t('qol.trend')}</h2>
            <div className={styles.chart}>
              <Line
                aria-label={t('qol.trend')}
                data={{
                  labels: summary?.series.map((p) => new Date(p.timestamp).toLocaleString()) || [],
                  datasets: [
                    {
                      label: t('qol.requests'),
                      data: summary?.series.map((p) => p.requests) || [],
                      borderColor: '#638bea',
                      backgroundColor: '#638bea',
                      tension: 0.25,
                      pointRadius: 0,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: false,
                  scales: { x: { ticks: { maxTicksLimit: 6 } }, y: { beginAtZero: true } },
                  plugins: { legend: { display: false } },
                }}
              />
            </div>
          </section>
          <section className={styles.panel}>
            <h2>{t('qol.key_usage')}</h2>
            <div className={styles.keyGrid}>
              {summary?.keys.map((k) => (
                <article key={k.id}>
                  <strong>{keyLabel(k.id, k.label)}</strong>
                  <span>
                    {number(k.requests)} {t('qol.requests')}
                  </span>
                  <span>
                    {money(k.cost)} · {number(k.total)} tokens
                  </span>
                </article>
              ))}
            </div>
            {summary?.groups_truncated && <p>{t('qol.truncated')}</p>}
          </section>
          <section className={styles.panel}>
            <h2>{t('qol.requests')}</h2>
            <RequestCards
              rows={requests?.items || []}
              names={names}
              keyLabel={keyLabel}
              onDetail={setDetail}
            />
            <div className={`${styles.tableWrap} ${styles.desktopRequests}`}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {[
                      'time',
                      'model',
                      'key',
                      'tokens',
                      'tier',
                      'cost',
                      'accounts',
                      'result',
                      'timing',
                    ].map((id) => (
                      <th key={id}>{t(`qol.${id}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests?.items.map((r) => (
                    <tr key={r.id}>
                      <td data-label={t('qol.time')}>{new Date(r.timestamp).toLocaleString()}</td>
                      <td data-label={t('qol.model')}>
                        {r.model}
                        <small>{r.executor || t('qol.unknown')}</small>
                      </td>
                      <td data-label={t('qol.key')}>{keyLabel(r.key, r.key_label)}</td>
                      <td data-label={t('qol.tokens')}>
                        <button className={styles.tokenButton} onClick={() => setDetail(r)}>
                          ↑ {number(r.context)} / ↓ {number(r.output)}
                          <small>
                            {t('qol.context')} {number(r.context)} ⓘ
                          </small>
                        </button>
                      </td>
                      <td data-label={t('qol.tier')}>
                        {r.tier || '—'}
                        <small>{r.thinking || '—'}</small>
                      </td>
                      <td data-label={t('qol.cost')}>{money(r.cost)}</td>
                      <td data-label={t('qol.accounts')}>
                        {names.get(r.account) || r.account || '—'}
                      </td>
                      <td data-label={t('qol.result')}>
                        {t(r.failed ? 'qol.failed' : 'qol.success')}
                      </td>
                      <td data-label={t('qol.timing')}>
                        {r.ttft_ms > 0 ? `${(r.ttft_ms / 1000).toFixed(2)}s` : '—'}
                        <small>
                          {r.ttft_ms > 0 && r.latency_ms > r.ttft_ms
                            ? `${((r.latency_ms - r.ttft_ms) / 1000).toFixed(2)}s · ${(r.output / ((r.latency_ms - r.ttft_ms) / 1000)).toFixed(1)} TPS`
                            : '—'}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && !requests?.items.length && <p>{t('qol.empty')}</p>}
            <footer className={styles.pagination}>
              <Button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
                {t('qol.previous')}
              </Button>
              <span>
                {page} / {Math.max(1, Math.ceil((requests?.total || 0) / 50))}
              </span>
              <Button
                disabled={loading || !requests || page * 50 >= requests.total}
                onClick={() => setPage(page + 1)}
              >
                {t('qol.next')}
              </Button>
            </footer>
          </section>
        </>
      )}
      {tab === 'accounts' && (
        <section className={styles.panel}>
          <div className={styles.accountToolbar}>
            <label>
              {t('qol.search')}
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void mutate(qolApi.refreshQuota)}
            >
              {t('qol.refresh_quota')}
            </Button>
            <Link to="/auth-files">{t('qol.manage_files')}</Link>
          </div>
          <p className={styles.hint}>{t('qol.quota_hint')}</p>
          {availableQuotas.length > 0 && (
            <fieldset className={styles.quotaChoices}>
              <legend>{t('qol.visible_quotas')}</legend>
              {availableQuotas.map((option) => (
                <label key={option.id}>
                  <input
                    type="checkbox"
                    checked={!hiddenQuotas.includes(option.id)}
                    onChange={(event) => toggleQuota(option.id, event.target.checked)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {['accounts', 'provider', 'plan', 'quota', 'proxy', 'status', 'actions'].map(
                    (id) => (
                      <th key={id}>{t(`qol.${id}`)}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((a) => (
                  <tr key={a.auth_index || a.id}>
                    <td data-label={t('qol.accounts')}>
                      {a.email || a.name}
                      <small>{a.name}</small>
                    </td>
                    <td data-label={t('qol.provider')}>{a.provider || a.type}</td>
                    <td data-label={t('qol.plan')}>{a.quota?.plan || '—'}</td>
                    <td data-label={t('qol.quota')}>
                      <div>
                        {a.quota?.windows
                          .filter((w) => !hiddenQuotas.includes(quotaWindowId(w)))
                          .map((w, i) => (
                            <div className={styles.quotaWindow} key={`${w.name}-${i}`}>
                              <span>
                                {w.name} · {w.seconds / 3600}h · {w.used_percent.toFixed(1)}%
                              </span>
                              <progress
                                aria-label={`${w.name} ${t('qol.used')}`}
                                max={100}
                                value={w.used_percent}
                              />
                              <small>
                                {t('qol.reset')}{' '}
                                {w.reset_at ? new Date(w.reset_at * 1000).toLocaleString() : '—'}
                              </small>
                            </div>
                          ))}
                        <small>
                          {t('qol.updated')}{' '}
                          {a.quota?.updated_at
                            ? new Date(a.quota.updated_at).toLocaleString()
                            : t('qol.unknown')}
                        </small>
                        {a.quota?.error && (
                          <small role="status" className={styles.error}>
                            {a.quota.error}
                          </small>
                        )}
                      </div>
                    </td>
                    <td data-label={t('qol.proxy')}>{a.quota?.proxy || '—'}</td>
                    <td data-label={t('qol.status')}>
                      {a.disabled ? t('qol.disabled') : a.status || t('qol.enabled')}
                    </td>
                    <td data-label={t('qol.actions')}>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void mutate(() => authFilesApi.setStatus(a.name, !a.disabled))
                        }
                      >
                        {t(a.disabled ? 'qol.enable' : 'qol.disable')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredAccounts.length && <p>{t('qol.empty')}</p>}
        </section>
      )}
      {tab === 'prices' && (
        <section>
          <p>{t('qol.prices_hint')}</p>
          <Button
            disabled={busy}
            onClick={() => void savePrices(loadModelPrices(), loadTierMultipliers())}
          >
            {t('qol.import_prices')}
          </Button>
          <fieldset disabled={busy} className={styles.priceFieldset}>
            <PriceSettingsCard
              modelNames={Object.keys(prices)}
              modelPrices={prices}
              onPricesChange={(next) => savePrices(next)}
              tierRules={rules}
              onTierRulesChange={(next) => void savePrices(prices, next)}
            />
          </fieldset>
        </section>
      )}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={t('qol.tokens')}>
        {detail && (
          <>
            <dl className={styles.details}>
              {(
                [
                  'input',
                  'output',
                  'reasoning',
                  'cache_read',
                  'cache_write',
                  'context',
                  'total',
                ] as const
              ).map((id) => (
                <div key={id}>
                  <dt>{t(`qol.${id}`)}</dt>
                  <dd>{number(detail[id])}</dd>
                </div>
              ))}
            </dl>
            <p>{t('qol.transport_hint')}</p>
          </>
        )}
      </Modal>
    </div>
  );
}
