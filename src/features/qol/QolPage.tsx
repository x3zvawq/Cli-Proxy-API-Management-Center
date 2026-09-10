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
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { IconRefreshCw } from '@/components/ui/icons';
import { PriceSettingsCard } from '@/components/usage/PriceSettingsCard';
import { useAuthStore, useConfigStore } from '@/stores';
import { authFilesApi } from '@/services/api/authFiles';
import { toLocalDateTime } from '@/utils/monitorAnalytics';
import { type ModelPrice } from '@/utils/usage';
import { type TierMultiplierRule } from '@/utils/tierMultiplier';
import {
  qolApi,
  type Account,
  type Filters,
  type Prices,
  type RequestPage,
  type Summary,
} from './api';
import styles from './QolPage.module.scss';
import { RequestTable } from './RequestTable';
import { ContextRecorder } from './ContextRecorder';
import { requestColumns, defaultColumns, selectedFields } from './requestColumns';
import { compactMoney, accountRates } from './metricFormatting';
import { QuotaColumnMenu } from './QuotaColumnMenu';
import { AccountQuota } from './AccountQuota';
import { UsageBreakdown } from './UsageBreakdown';
import { AccountName } from './AccountName';
import { AccountProbe } from './AccountProbe';
import { PlanBadge } from './PlanBadge';
import { useQolPriceStore } from './priceStore';
import { useQuotaRefresh } from './useQuotaRefresh';
import quotaStyles from './AccountQuota.module.scss';
import {
  keyPrefixes,
  quotaOptions,
  relativeTimeRange,
  readHiddenQuotas,
  accountLabel,
  formatTokens,
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
const money = compactMoney;
const initialRange = () => relativeTimeRange(1);

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
  const [relativeDays, setRelativeDays] = useState<number | null>(1);
  const [draft, setDraft] = useState(() => ({
    start: toLocalDateTime(Date.parse(filters.start)),
    end: toLocalDateTime(Date.parse(filters.end)),
  }));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [keyOptions, setKeyOptions] = useState<{ id: string; label: string }[]>([]);
  const [requests, setRequests] = useState<RequestPage | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const prices = useQolPriceStore((state) => state.prices);
  const pricesLoaded = useQolPriceStore((state) => state.loaded);
  const [usedModels, setUsedModels] = useState<string[]>([]);
  const {
    refresh: refreshQuota,
    refreshing: quotaRefreshing,
    status: refreshStatus,
  } = useQuotaRefresh(setAccounts);
  const [page, setPage] = useState(1);
  const [contextGroup, setContextGroup] = useState<string | undefined>();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountSummary, setAccountSummary] = useState<Summary | null>(null);
  const [query, setQuery] = useState('');
  const [columns, setColumns] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(`cpa-request-columns:${base}`) || 'null'
      );
      if (Array.isArray(saved)) {
        const valid = requestColumns.filter((c) => saved.includes(c.id)).map((c) => c.id);
        if (valid.length) return valid;
      }
    } catch {
      /* Use defaults for an absent or invalid preference. */
    }
    return defaultColumns;
  });
  const fields = `${selectedFields(columns)},context_group`;
  const toggleColumn = (id: string, visible: boolean) => {
    const next = visible ? [...columns, id] : columns.filter((c) => c !== id);
    if (!next.length) return;
    setColumns(next);
    try {
      localStorage.setItem(`cpa-request-columns:${base}`, JSON.stringify(next));
    } catch {
      /* Session preference remains usable. */
    }
  };
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'monitor') return;
    const refresh = () => {
      if (document.hidden || loading || summaryLoading) return;
      // Freeze pagination and custom ranges; only a live first page follows now.
      if (relativeDays !== null && page === 1) {
        const range = relativeTimeRange(relativeDays);
        setDraft((current) =>
          current.start === toLocalDateTime(Date.parse(filters.start)) &&
          current.end === toLocalDateTime(Date.parse(filters.end))
            ? {
                start: toLocalDateTime(Date.parse(range.start)),
                end: toLocalDateTime(Date.parse(range.end)),
              }
            : current
        );
        setFilters((current) => ({ ...current, ...range }));
      } else {
        setRevision((value) => value + 1);
      }
    };
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [tab, relativeDays, page, loading, summaryLoading, filters.start, filters.end]);

  useEffect(() => {
    const controller = new AbortController();
    void qolApi
      .accounts(controller.signal)
      .then(setAccounts)
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (tab !== 'prices' && tab !== 'monitor') return;
    let active = true;
    void useQolPriceStore
      .getState()
      .load()
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    const controller = new AbortController();
    void qolApi
      .models(controller.signal)
      .then(setUsedModels)
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'monitor') return;
    const controller = new AbortController();
    setSummaryLoading(true);
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
      })
      .finally(() => {
        if (!controller.signal.aborted) setSummaryLoading(false);
      });
    return () => controller.abort();
  }, [filters, revision, tab]);

  useEffect(() => {
    if (tab !== 'monitor') return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void qolApi
      .requests({ ...filters, page, page_size: 50, fields }, controller.signal)
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
  }, [filters, page, revision, tab, fields]);

  useEffect(() => {
    if (tab !== 'accounts' || quotaRefreshing) return;
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
  }, [tab, quotaRefreshing]);

  useEffect(() => {
    if (tab !== 'accounts' || quotaRefreshing) return;
    let current: AbortController | undefined;
    const update = () => {
      current?.abort();
      current = new AbortController();
      const signal = current.signal;
      void qolApi
        .summary(relativeTimeRange(1), signal)
        .then((value) => {
          if (!signal.aborted) setAccountSummary(value);
        })
        .catch((e: Error) => {
          if (!signal.aborted) {
            setAccountSummary(null);
            setError(e.message);
          }
        });
    };
    update();
    const timer = window.setInterval(() => {
      if (!document.hidden) update();
    }, 60000);
    return () => {
      clearInterval(timer);
      current?.abort();
    };
  }, [tab, revision, quotaRefreshing]);

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
    setRelativeDays(null);
    setFilters((f) => ({ ...f, start: start.toISOString(), end: end.toISOString() }));
  };
  const names = useMemo(
    () => new Map(accounts.map((a) => [a.auth_index, accountLabel(a)])),
    [accounts]
  );
  const filteredAccounts = accounts.filter((a) =>
    `${a.display_name || ''} ${a.email} ${a.name} ${a.provider} ${a.quota?.plan || ''}`
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
      await useQolPriceStore.getState().save(merged);
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
          className={styles.refreshButton}
          size="sm"
          variant="secondary"
          disabled={busy || loading || quotaRefreshing}
          aria-busy={loading || quotaRefreshing}
          onClick={() => {
            if (tab === 'accounts') {
              void refreshQuota().catch(() => {});
              return;
            }
            if (relativeDays !== null && tab === 'monitor') {
              const range = relativeTimeRange(relativeDays);
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
          <IconRefreshCw
            size={14}
            className={loading || quotaRefreshing ? quotaStyles.spinning : undefined}
          />
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
            <Button size="sm" onClick={applyRange}>
              {t('qol.apply')}
            </Button>
            {[1, 7, 30].map((days) => (
              <Button
                key={days}
                size="sm"
                variant={relativeDays === days ? 'primary' : 'secondary'}
                onClick={() => {
                  const next = relativeTimeRange(days);
                  setRelativeDays(days);
                  setFilters((f) => ({ ...f, ...next }));
                  setDraft({
                    start: toLocalDateTime(Date.parse(next.start)),
                    end: toLocalDateTime(Date.parse(next.end)),
                  });
                  setPage(1);
                }}
              >
                {t(days === 1 ? 'qol.day' : days === 7 ? 'qol.week' : 'qol.month')}
              </Button>
            ))}
          </section>
          <section className={styles.filters} aria-label={t('qol.request_filters')}>
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
                    {accountLabel(a)}
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
              ['cache_read', totals ? formatTokens(totals.cache_read) : '—'],
              ['cache_write', totals ? formatTokens(totals.cache_write) : '—'],
              [
                'cache_hit',
                totals?.context
                  ? `${((totals.cache_read / totals.context) * 100).toFixed(1)}%`
                  : '—',
              ],
              ['ttft', totals?.ttft_ms ? `${(totals.ttft_ms / 1000).toFixed(2)}s` : '—'],
            ].map(([label, value]) => (
              <article
                key={label}
                title={
                  label === 'cost'
                    ? t('qol.cost_hint', {
                        priced: totals?.priced || 0,
                        total: totals?.requests || 0,
                      })
                    : undefined
                }
              >
                <span>{t(`qol.${label}`)}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>

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
          <UsageBreakdown summary={summary} names={names} keyLabel={keyLabel} />
          <section className={styles.panel}>
            <div className={styles.breakdownHeading}>
              <h2>{t('qol.request_details')}</h2>
              <ContextRecorder filters={filters} groupId={contextGroup} onCloseGroup={() => setContextGroup(undefined)} />
              <QuotaColumnMenu
                label={t('qol.visible_columns')}
                title={t('qol.visible_columns')}
                options={requestColumns.map((c) => ({ id: c.id, label: t(`qol.${c.id}`) }))}
                hidden={requestColumns.filter((c) => !columns.includes(c.id)).map((c) => c.id)}
                disabled={columns.length === 1 ? columns : []}
                onToggle={toggleColumn}
              />
            </div>
            <RequestTable
              rows={requests?.items || []}
              columns={columns}
              names={names}
              keyLabel={keyLabel}
              onViewContext={setContextGroup}
            />
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
            <Link to="/auth-files">{t('qol.manage_files')}</Link>
          </div>
          {refreshStatus && (
            <p role="alert" className={styles.error}>
              {refreshStatus}
            </p>
          )}
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.accountTable}`}>
              <thead>
                <tr>
                  {[
                    'accounts',
                    'provider',
                    'plan',
                    'enabled',
                    'quota',
                    'proxy',
                    'account_rates',
                  ].map((id) => (
                    <th key={id} className={id === 'quota' ? styles.quotaHeader : undefined}>
                      {id === 'quota' ? (
                        <div className={styles.quotaHeading}>
                          <QuotaColumnMenu
                            options={availableQuotas}
                            hidden={hiddenQuotas}
                            onToggle={toggleQuota}
                          />
                          <button
                            className={quotaStyles.textButton}
                            disabled={quotaRefreshing}
                            aria-busy={quotaRefreshing}
                            onClick={() => void refreshQuota().catch(() => {})}
                          >
                            <IconRefreshCw
                              size={13}
                              className={quotaRefreshing ? quotaStyles.spinning : undefined}
                            />
                            {t(quotaRefreshing ? 'qol.refreshing' : 'qol.refresh_all')}
                          </button>
                        </div>
                      ) : (
                        t(`qol.${id}`)
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((a) => (
                  <tr key={a.auth_index || a.id}>
                    <td data-label={t('qol.accounts')}>
                      <AccountName account={a} onChange={() => setRevision((v) => v + 1)} />
                      <AccountProbe account={a} />
                    </td>
                    <td data-label={t('qol.provider')}>{a.provider || a.type}</td>
                    <td data-label={t('qol.plan')}>
                      <PlanBadge plan={a.quota?.plan} />
                    </td>
                    <td data-label={t('qol.enabled')} className={styles.switchCell}>
                      <ToggleSwitch
                        checked={!a.disabled}
                        disabled={busy || quotaRefreshing}
                        ariaLabel={`${t(a.disabled ? 'qol.enable' : 'qol.disable')} ${accountLabel(a)}`}
                        onChange={(enabled) =>
                          void mutate(() => authFilesApi.setStatus(a.name, !enabled))
                        }
                      />
                    </td>
                    <td data-label={t('qol.quota')}>
                      <AccountQuota
                        account={a}
                        hidden={hiddenQuotas}
                        onRefresh={refreshQuota}
                        refreshing={quotaRefreshing}
                      />
                    </td>
                    <td data-label={t('qol.proxy')}>{a.quota?.proxy || '—'}</td>
                    <td data-label={t('qol.account_rates')} title={t('qol.account_rates_hint')}>
                      {(() => {
                        const row = accountSummary?.accounts.find(
                          (item) => item.id === a.auth_index
                        );
                        const rates = accountRates(row);
                        return (
                          <div className={styles.accountRates}>
                            <span>
                              {t('qol.success_rate')}{' '}
                              <b>
                                {rates.success === null
                                  ? '—'
                                  : (rates.success * 100).toFixed(1) + '%'}
                              </b>
                            </span>
                            <span>
                              {t('qol.cache_hit')}{' '}
                              <b>
                                {rates.cache === null ? '—' : (rates.cache * 100).toFixed(1) + '%'}
                              </b>
                            </span>
                          </div>
                        );
                      })()}
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
          <fieldset disabled={busy || !pricesLoaded} className={styles.priceFieldset}>
            <PriceSettingsCard
              modelNames={usedModels}
              usedModelNames={usedModels}
              modelPrices={prices}
              onPricesChange={(next) => savePrices(next)}
              tierRules={rules}
              onTierRulesChange={(next) => void savePrices(prices, next)}
            />
          </fieldset>
        </section>
      )}
    </div>
  );
}
