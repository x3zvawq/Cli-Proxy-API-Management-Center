import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFilesApi } from '@/services/api/authFiles';
import type { AuthFileItem } from '@/types/authFile';
import type { CredentialInfo } from '@/types/sourceInfo';
import { buildSourceInfoMap, resolveSourceDisplay } from '@/utils/sourceResolver';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useConfigStore, useThemeStore } from '@/stores';
import {
  ModelStatsCard,
  PriceSettingsCard,
  RequestEventsDetailsCard,
  useSparklines,
  useUsageData,
  type UsagePayload,
} from '@/components/usage';
import type { ModelStat } from '@/components/usage/ModelStatsCard';
import { MonitorStatCards } from '@/components/monitor/MonitorStatCards';
import { MonitorTrendChart } from '@/components/monitor/MonitorTrendChart';
import { ModelUsageDistributionCard } from '@/components/monitor/ModelUsageDistributionCard';
import { MonitorApiKeyStatsCard } from '@/components/monitor/MonitorApiKeyStatsCard';
import { MonitorBreakdown } from '@/components/monitor/MonitorBreakdown';
import {
  EMPTY_MONITOR_FILTERS,
  filterMonitorUsage,
  monitorKeyLabel,
  parseMonitorRange,
  toLocalDateTime,
  type MonitorDateRange,
} from '@/utils/monitorAnalytics';
import {
  filterUsageByTimeRange,
  collectUsageDetailsWithEndpoint,
  normalizeAuthIndex,
  getModelNamesFromUsage,
  getModelStats,
  type UsageTimeRange,
} from '@/utils/usage';
import {
  DEFAULT_USAGE_TIME_RANGE,
  HOUR_WINDOW_BY_USAGE_TIME_RANGE,
  USAGE_TIME_RANGE_OPTIONS,
  isUsageTimeRange,
} from '@/utils/usageTimeRange';
import styles from './MonitoringCenterPage.module.scss';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineController,
  LineElement,
  BarController,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const TIME_RANGE_STORAGE_KEY = 'cli-proxy-monitor-time-range-v1';

const loadTimeRange = (): UsageTimeRange => {
  try {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_USAGE_TIME_RANGE;
    }
    const raw = localStorage.getItem(TIME_RANGE_STORAGE_KEY);
    return isUsageTimeRange(raw) ? raw : DEFAULT_USAGE_TIME_RANGE;
  } catch {
    return DEFAULT_USAGE_TIME_RANGE;
  }
};

export function MonitoringCenterPage() {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const isDark = resolvedTheme === 'dark';
  const config = useConfigStore((state) => state.config);
  const [timeRange, setTimeRange] = useState<UsageTimeRange>(loadTimeRange);
  const [customRange, setCustomRange] = useState<MonitorDateRange>();
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [priceSettingsOpen, setPriceSettingsOpen] = useState(false);
  const [startDraft, setStartDraft] = useState(() => toLocalDateTime(Date.now() - 86_400_000));
  const [endDraft, setEndDraft] = useState(() => toLocalDateTime(Date.now()));
  const [rangeError, setRangeError] = useState(false);
  const [filters, setFilters] = useState(EMPTY_MONITOR_FILTERS);
  const [usageStatsDimension, setUsageStatsDimension] = useState<'model' | 'apiKey'>('model');

  const { usage, loading, error, lastRefreshedAt, modelPrices, setModelPrices, loadUsage } =
    useUsageData({ timeRange, dateRange: customRange });
  const [authFiles, setAuthFiles] = useState<AuthFileItem[]>([]);

  const loadAuthFiles = useCallback(async () => {
    const res = await authFilesApi.list();
    const files = Array.isArray(res) ? res : (res as { files?: AuthFileItem[] })?.files;
    if (!Array.isArray(files)) return;
    setAuthFiles(files);
  }, []);

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadUsage(), loadAuthFiles()]);
  }, [loadAuthFiles, loadUsage]);

  useHeaderRefresh(handleRefresh);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAuthFiles().catch(() => {});
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAuthFiles]);

  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      localStorage.setItem(TIME_RANGE_STORAGE_KEY, timeRange);
    } catch {
      // Ignore storage errors.
    }
  }, [timeRange]);

  const timeFilteredUsage = useMemo(
    () =>
      usage
        ? customRange
          ? filterMonitorUsage(usage, EMPTY_MONITOR_FILTERS, customRange)
          : filterUsageByTimeRange(usage, timeRange)
        : null,
    [usage, timeRange, customRange]
  );
  const filteredUsage = useMemo(
    () => (timeFilteredUsage ? filterMonitorUsage(timeFilteredUsage, filters) : null),
    [timeFilteredUsage, filters]
  );
  const availableDetails = useMemo(
    () => collectUsageDetailsWithEndpoint(timeFilteredUsage),
    [timeFilteredUsage]
  );
  const dimensionOptions = useMemo(
    () => ({
      apiKey: [...new Set(availableDetails.map((d) => d.__endpoint))].sort(),
      model: [...new Set(availableDetails.map((d) => d.__modelName || 'unknown'))].sort(),
      source: [...new Set(availableDetails.map((d) => d.source))].sort(),
    }),
    [availableDetails]
  );
  const sourceLabels = useMemo(() => {
    const sources = buildSourceInfoMap({
      geminiApiKeys: config?.geminiApiKeys,
      claudeApiKeys: config?.claudeApiKeys,
      codexApiKeys: config?.codexApiKeys,
      vertexApiKeys: config?.vertexApiKeys,
      openaiCompatibility: config?.openaiCompatibility,
    });
    const files = new Map<string, CredentialInfo>();
    authFiles.forEach((file) => {
      const key = normalizeAuthIndex(file.auth_index ?? file.authIndex);
      if (key)
        files.set(key, { name: file.name || key, type: String(file.type || file.provider || '') });
    });
    return new Map(
      availableDetails.map((d) => [
        d.source,
        resolveSourceDisplay(d.source, d.auth_index, sources, files).displayName,
      ])
    );
  }, [availableDetails, authFiles, config]);
  const hourWindowHours =
    timeRange === 'all' ? undefined : HOUR_WINDOW_BY_USAGE_TIME_RANGE[timeRange];
  const rateWindowMinutes = useMemo(() => {
    if (timeRange === '7h') return 7 * 60;
    if (timeRange === '24h') return 24 * 60;
    if (timeRange === '7d') return 7 * 24 * 60;
    if (timeRange === '30d') return 30 * 24 * 60;
    return 30;
  }, [timeRange]);
  const nowMs = lastRefreshedAt?.getTime() ?? 0;
  const chartRange =
    customRange ??
    (hourWindowHours && nowMs
      ? { startMs: nowMs - hourWindowHours * 3_600_000, endMs: nowMs }
      : undefined);

  const { requestsSparkline, tokensSparkline, rpmSparkline, tpmSparkline, costSparkline } =
    useSparklines({
      usage: customRange ? null : (filteredUsage as UsagePayload | null),
      loading,
      nowMs,
      timeRange,
      modelPrices,
    });

  const modelNames = useMemo(() => getModelNamesFromUsage(usage), [usage]);
  const modelStats = useMemo<ModelStat[]>(
    () => getModelStats(filteredUsage, modelPrices),
    [filteredUsage, modelPrices]
  );

  const handleTimeRangeChange = useCallback((range: UsageTimeRange) => {
    setTimeRange(range);
    setCustomRange(undefined);
    setShowCustomRange(false);
    setRangeError(false);
  }, []);

  const applyCustomRange = () => {
    const next = parseMonitorRange(startDraft, endDraft);
    setRangeError(!next);
    if (next) setCustomRange(next);
  };

  const usageStatsToggle = (
    <div className={styles.periodButtons}>
      <Button
        variant={usageStatsDimension === 'model' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => setUsageStatsDimension('model')}
      >
        {t('monitoring_center.usage_stats_by_model')}
      </Button>
      <Button
        variant={usageStatsDimension === 'apiKey' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => setUsageStatsDimension('apiKey')}
      >
        {t('monitoring_center.usage_stats_by_api_key')}
      </Button>
    </div>
  );

  return (
    <div className={styles.container}>
      {loading && !usage && (
        <div className={styles.loadingOverlay} aria-busy="true">
          <div className={styles.loadingOverlayContent}>
            <LoadingSpinner size={28} className={styles.loadingOverlaySpinner} />
            <span className={styles.loadingOverlayText}>{t('common.loading')}</span>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <h1 className={styles.pageTitle}>{t('monitoring_center.title')}</h1>
        <div className={styles.headerActions}>
          <Button
            variant={priceSettingsOpen ? 'primary' : 'secondary'}
            size="sm"
            aria-expanded={priceSettingsOpen}
            aria-controls="monitor-model-prices"
            onClick={() => setPriceSettingsOpen((open) => !open)}
          >
            {t('monitor_custom.price_entry')}
          </Button>
          <div className={styles.timeRangeButtons}>
            {USAGE_TIME_RANGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={!customRange && timeRange === option.value ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handleTimeRangeChange(option.value)}
              >
                {t(option.labelKey)}
              </Button>
            ))}
            <Button
              variant={customRange ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowCustomRange(!showCustomRange)}
            >
              {t('monitor_custom.custom_range')}
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleRefresh().catch(() => {})}
            disabled={loading}
          >
            {loading ? t('common.loading') : t('usage_stats.refresh')}
          </Button>
          {lastRefreshedAt && (
            <span className={styles.lastRefreshed}>
              {t('usage_stats.last_updated')}: {lastRefreshedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <section id="monitor-model-prices" hidden={!priceSettingsOpen} aria-label={t('monitor_custom.price_entry')}>
        <PriceSettingsCard
          modelNames={modelNames}
          modelPrices={modelPrices}
          onPricesChange={setModelPrices}
        />
      </section>

      <section className={styles.filterPanel} aria-label={t('monitor_custom.filters')}>
        {showCustomRange && (
          <div className={styles.filterRow}>
            <Input
              type="datetime-local"
              label={t('monitor_custom.start')}
              value={startDraft}
              onChange={(e) => setStartDraft(e.target.value)}
            />
            <Input
              type="datetime-local"
              label={t('monitor_custom.end')}
              value={endDraft}
              onChange={(e) => setEndDraft(e.target.value)}
            />
            <Button size="sm" onClick={applyCustomRange} disabled={loading}>
              {t('monitor_custom.apply')}
            </Button>
          </div>
        )}
        {rangeError && (
          <div role="alert" className={styles.errorBox}>
            {t('monitor_custom.invalid_range')}
          </div>
        )}
        <p className={styles.cardHint}>
          {t('monitor_custom.range_hint', {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })}
        </p>
        {customRange && (
          <p className={styles.cardHint}>
            {t('monitor_custom.active_range')}: {new Date(customRange.startMs).toLocaleString()} →{' '}
            {new Date(customRange.endMs).toLocaleString()}
          </p>
        )}
        <div className={styles.filterRow}>
          {(['apiKey', 'model', 'source'] as const).map((field) => (
            <div key={field} className={styles.filterItem}>
              <span className={styles.requestEventsFilterLabel}>
                {t(`monitor_custom.${field}`)}
              </span>
              <Select
                ariaLabel={t(`monitor_custom.${field}`)}
                value={filters[field]}
                onChange={(value) => setFilters({ ...filters, [field]: value })}
                options={[
                  { value: '', label: t('usage_stats.filter_all') },
                  ...[
                    ...new Set([
                      ...dimensionOptions[field],
                      ...(filters[field] ? [filters[field]] : []),
                    ]),
                  ].map((value) => ({
                    value,
                    label:
                      field === 'apiKey'
                        ? monitorKeyLabel(value)
                        : field === 'source'
                          ? sourceLabels.get(value) || value
                          : value,
                  })),
                ]}
              />
            </div>
          ))}
          <div className={styles.filterItem}>
            <span className={styles.requestEventsFilterLabel}>{t('monitor_custom.result')}</span>
            <Select
              ariaLabel={t('monitor_custom.result')}
              value={filters.result}
              onChange={(value) => setFilters({ ...filters, result: value })}
              options={[
                { value: '', label: t('usage_stats.filter_all') },
                { value: 'success', label: t('stats.success') },
                { value: 'failure', label: t('stats.failure') },
              ]}
            />
          </div>
          <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_MONITOR_FILTERS)}>
            {t('monitor_custom.reset')}
          </Button>
        </div>
        <p className={styles.cardHint}>{t('monitor_custom.filter_hint')}</p>
      </section>

      <MonitorStatCards
        usage={filteredUsage as UsagePayload | null}
        loading={loading}
        modelPrices={modelPrices}
        rateWindowMinutes={rateWindowMinutes}
        dateRange={customRange}
        timeRange={timeRange}
        sparklines={{
          requests: requestsSparkline,
          tokens: tokensSparkline,
          rpm: rpmSparkline,
          tpm: tpmSparkline,
          cost: costSparkline,
        }}
      />
      <MonitorBreakdown usage={filteredUsage} loading={loading} />

      <div className={styles.topGrid}>
        <MonitorTrendChart
          usage={filteredUsage as UsagePayload | null}
          loading={loading}
          isDark={isDark}
          isMobile={isMobile}
          dateRange={chartRange}
          modelPrices={modelPrices}
        />
        <ModelUsageDistributionCard modelStats={modelStats} loading={loading} isDark={isDark} />
      </div>

      <div className={styles.middleGrid}>
        {usageStatsDimension === 'model' ? (
          <ModelStatsCard
            modelStats={modelStats}
            loading={loading}
            hasPrices={true}
            title={t('monitoring_center.usage_stats_title')}
            extra={usageStatsToggle}
          />
        ) : (
          <MonitorApiKeyStatsCard
            usage={filteredUsage as UsagePayload | null}
            loading={loading}
            modelPrices={modelPrices}
            title={t('monitoring_center.usage_stats_title')}
            extra={usageStatsToggle}
          />
        )}
      </div>

      <div className={styles.fullWidthSection}>
        <RequestEventsDetailsCard
          usage={filteredUsage}
          modelPrices={modelPrices}
          loading={loading}
          geminiKeys={config?.geminiApiKeys || []}
          claudeConfigs={config?.claudeApiKeys || []}
          codexConfigs={config?.codexApiKeys || []}
          vertexConfigs={config?.vertexApiKeys || []}
          openaiProviders={config?.openaiCompatibility || []}
          authFiles={authFiles}
          onRefresh={handleRefresh}
          lastRefreshedAt={lastRefreshedAt}
        />
      </div>
    </div>
  );
}
