import { useMemo, useState } from 'react';
import type { ChartData, ChartOptions } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { collectUsageDetailsWithEndpoint, formatUsd, type ModelPrice } from '@/utils/usage';
import { buildMonitorTrend, type MonitorDateRange } from '@/utils/monitorAnalytics';
import type { UsagePayload } from '@/components/usage';
import styles from '@/pages/MonitoringCenterPage.module.scss';

export interface MonitorTrendChartProps {
  usage: UsagePayload | null;
  loading: boolean;
  isDark: boolean;
  isMobile: boolean;
  dateRange?: MonitorDateRange;
  modelPrices: Record<string, ModelPrice>;
}

const TOKEN_AXIS_UNITS = [
  { value: 1_000_000_000_000, suffix: 'T' },
  { value: 1_000_000_000, suffix: 'B' },
  { value: 1_000_000, suffix: 'M' },
  { value: 1_000, suffix: 'K' },
];

const getTokenAxisUnit = (tickValues: number[]) => {
  const positive = tickValues
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.abs(value))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  const smallestStep =
    positive.reduce<number | null>((step, value, index) => {
      if (index === 0) return step;
      const diff = value - positive[index - 1];
      if (diff <= 0) return step;
      return step === null ? diff : Math.min(step, diff);
    }, null) ??
    positive[0] ??
    0;

  return TOKEN_AXIS_UNITS.find((unit) => smallestStep >= unit.value) ?? null;
};

const formatTokenAxisValue = (value: number, ticks: { value: number | string }[]) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '0';
  }
  if (numeric === 0) {
    return '0';
  }

  const unit = getTokenAxisUnit(ticks.map((tick) => Number(tick.value)));
  if (!unit) {
    return numeric.toLocaleString();
  }

  const scaled = numeric / unit.value;
  const absScaled = Math.abs(scaled);
  const fractionDigits = Number.isInteger(scaled) ? 0 : absScaled >= 10 ? 1 : 2;
  return `${scaled.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })}${unit.suffix}`;
};

const formatCostValue = (value: number) => formatUsd(value);

export function MonitorTrendChart({
  usage,
  loading,
  isDark,
  isMobile,
  dateRange,
  modelPrices,
}: MonitorTrendChartProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'hour' | 'day'>('hour');
  const [metric, setMetric] = useState<'tokens' | 'requests'>('tokens');
  const hasPrices = useMemo(
    () =>
      collectUsageDetailsWithEndpoint(usage).some((detail) =>
        Boolean(modelPrices[detail.__modelName || ''])
      ),
    [usage, modelPrices]
  );

  const trend = useMemo(
    () => buildMonitorTrend(usage, modelPrices, period, dateRange),
    [usage, modelPrices, period, dateRange]
  );

  const chartData = useMemo<ChartData<'line'>>(
    () => ({
      labels: trend.labels,
      datasets: [
        {
          type: 'line' as const,
          label: t(metric === 'tokens' ? 'usage_stats.total_tokens' : 'usage_stats.total_requests'),
          data: metric === 'tokens' ? trend.tokenSeries : trend.requestSeries,
          yAxisID: 'yTokens',
          backgroundColor: 'rgba(139, 92, 246, 0.12)',
          borderColor: 'rgba(139, 92, 246, 0.9)',
          borderWidth: 2,
          cubicInterpolationMode: 'monotone',
          fill: true,
          pointRadius: trend.labels.length > 60 ? 0 : 2,
          pointHoverRadius: 4,
          order: 2,
        },
        {
          type: 'line' as const,
          label: t('usage_stats.total_cost'),
          data: trend.costSeries,
          yAxisID: 'yCost',
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.18)',
          pointBackgroundColor: '#f59e0b',
          pointBorderColor: '#f59e0b',
          pointRadius: isMobile && period === 'hour' ? 0 : isMobile ? 2 : 3,
          pointHoverRadius: 4,
          cubicInterpolationMode: 'monotone',
          fill: false,
          borderWidth: isMobile ? 1.5 : 2,
          order: 1,
        },
      ].filter(
        (dataset) => dataset.yAxisID !== 'yCost' || hasPrices
      ) as ChartData<'line'>['datasets'],
    }),
    [isMobile, period, t, trend, metric, hasPrices]
  );

  const chartOptions = useMemo<ChartOptions<'line'>>(() => {
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(17, 24, 39, 0.06)';
    const axisBorderColor = isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(17, 24, 39, 0.10)';
    const tickColor = isDark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(17, 24, 39, 0.72)';
    const tooltipBg = isDark ? 'rgba(17, 24, 39, 0.92)' : 'rgba(255, 255, 255, 0.98)';
    const tooltipTitle = isDark ? '#ffffff' : '#111827';
    const tooltipBody = isDark ? 'rgba(255, 255, 255, 0.86)' : '#374151';
    const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(17, 24, 39, 0.10)';
    const tickFontSize = isMobile ? 10 : 12;
    const maxTickLabelCount = isMobile ? (period === 'hour' ? 8 : 6) : period === 'hour' ? 12 : 10;

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: tooltipTitle,
          bodyColor: tooltipBody,
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: 10,
          displayColors: true,
          usePointStyle: true,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || '';
              const value = Number(context.parsed?.y ?? 0);
              if (context.dataset.yAxisID === 'yCost') {
                return `${label}: ${formatCostValue(value)}`;
              }
              return `${label}: ${value.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: gridColor,
            drawTicks: false,
          },
          border: {
            color: axisBorderColor,
          },
          ticks: {
            color: tickColor,
            font: { size: tickFontSize },
            maxRotation: isMobile ? 0 : 45,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: maxTickLabelCount,
            callback: (value) => {
              const index = typeof value === 'number' ? value : Number(value);
              const raw =
                Number.isFinite(index) && trend.labels[index]
                  ? trend.labels[index]
                  : typeof value === 'string'
                    ? value
                    : '';

              if (period === 'hour') {
                const [md, time] = raw.split(' ');
                if (!time) return raw;
                if (time.startsWith('00:')) {
                  return md ? [md, time] : time;
                }
                return time;
              }

              if (isMobile) {
                const parts = raw.split('-');
                if (parts.length === 3) {
                  return `${parts[1]}-${parts[2]}`;
                }
              }
              return raw;
            },
          },
        },
        yTokens: {
          beginAtZero: true,
          position: 'left',
          grid: {
            color: gridColor,
          },
          border: {
            color: axisBorderColor,
          },
          ticks: {
            color: tickColor,
            font: { size: tickFontSize },
            callback: (value, _index, ticks) => formatTokenAxisValue(Number(value), ticks),
          },
        },
        yCost: {
          display: hasPrices,
          beginAtZero: true,
          position: 'right',
          grid: {
            drawOnChartArea: false,
          },
          border: {
            color: axisBorderColor,
          },
          ticks: {
            color: tickColor,
            font: { size: tickFontSize },
            callback: (value) => formatCostValue(Number(value)),
          },
        },
      },
    };
  }, [isDark, isMobile, period, trend.labels, hasPrices]);

  return (
    <Card
      title={t('monitor_custom.trend_title')}
      extra={
        <div className={styles.periodButtons}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMetric(metric === 'tokens' ? 'requests' : 'tokens')}
          >
            {t(metric === 'tokens' ? 'usage_stats.total_requests' : 'usage_stats.total_tokens')}
          </Button>
          <Button
            variant={period === 'hour' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setPeriod('hour')}
          >
            {t('usage_stats.by_hour')}
          </Button>
          <Button
            variant={period === 'day' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setPeriod('day')}
          >
            {t('usage_stats.by_day')}
          </Button>
        </div>
      }
      className={styles.detailsFixedCard}
    >
      {loading ? (
        <div className={styles.hint}>{t('common.loading')}</div>
      ) : trend.labels.length > 0 ? (
        <div className={styles.chartWrapper}>
          <p className={styles.cardHint}>{t('monitor_custom.bucket_hint')}</p>
          <div className={styles.chartLegend} aria-label="Chart legend">
            {chartData.datasets.map((dataset, index) => (
              <div
                key={`${dataset.label}-${index}`}
                className={styles.legendItem}
                title={dataset.label}
              >
                <span
                  className={styles.legendDot}
                  style={{ backgroundColor: String(dataset.borderColor) }}
                />
                <span className={styles.legendLabel}>{dataset.label}</span>
              </div>
            ))}
          </div>
          <div className={styles.chartArea}>
            <div className={styles.chartScroller}>
              <div className={styles.chartCanvas}>
                <Chart type="line" data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.hint}>{t('usage_stats.no_data')}</div>
      )}
    </Card>
  );
}
