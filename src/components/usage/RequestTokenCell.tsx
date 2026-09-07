import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { IconInfo } from '@/components/ui/icons';
import { formatCompactNumber } from '@/utils/usage';
import styles from './RequestTokenCell.module.scss';

export interface RequestTokenMetrics {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  contextTokens: number;
  cacheHitRatio: number | null;
}

export function RequestTokenCell({ metrics }: { metrics: RequestTokenMetrics }) {
  const { t } = useTranslation();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const show = () => {
    cancelClose();
    setOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (document.activeElement !== trigger.current && !popup.current?.matches(':hover'))
        setOpen(false);
    }, 160);
  };
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );
  useLayoutEffect(() => {
    if (!open || !trigger.current || !popup.current) return;
    const bounds = trigger.current.getBoundingClientRect();
    const box = popup.current.getBoundingClientRect();
    // Render outside the scrolling table, with a bounded position for narrow screens.
    setPosition({
      left: Math.max(8, Math.min(bounds.right - box.width, window.innerWidth - box.width - 8)),
      top: Math.max(
        8,
        Math.min(
          bounds.bottom + 6 + box.height <= window.innerHeight - 8
            ? bounds.bottom + 6
            : bounds.top - box.height - 6,
          window.innerHeight - box.height - 8
        )
      ),
    });
    const closeOnOutside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnScroll = (event: Event) => {
      if (!popup.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [open]);
  const details = [
    [t('usage_stats.input_tokens'), metrics.inputTokens.toLocaleString()],
    [t('usage_stats.output_tokens'), metrics.outputTokens.toLocaleString()],
    [t('usage_stats.reasoning_tokens'), metrics.reasoningTokens.toLocaleString()],
    [t('usage_stats.cached_tokens'), metrics.cachedTokens.toLocaleString()],
    [t('monitor_custom.cache_write'), metrics.cacheCreationTokens.toLocaleString()],
    [
      t('usage_stats.cache_hit'),
      metrics.cacheHitRatio === null ? '--' : `${(metrics.cacheHitRatio * 100).toFixed(1)}%`,
    ],
    [t('monitor_custom.context'), metrics.contextTokens.toLocaleString()],
    [t('usage_stats.total_tokens'), metrics.totalTokens.toLocaleString()],
  ];
  return (
    <div className={styles.cell}>
      <div className={styles.summary}>
        <div className={styles.flow}>
          <span title={`${t('usage_stats.input_tokens')}: ${metrics.inputTokens.toLocaleString()}`}>
            ↑ {formatCompactNumber(metrics.inputTokens)}
          </span>
          <span
            title={`${t('usage_stats.output_tokens')}: ${metrics.outputTokens.toLocaleString()}`}
          >
            ↓ {formatCompactNumber(metrics.outputTokens)}
          </span>
        </div>
        <div className={styles.context}>
          {t('monitor_custom.context_short')} {formatCompactNumber(metrics.contextTokens)}
        </div>
      </div>
      <button
        ref={trigger}
        type="button"
        className={styles.info}
        aria-label={t('monitor_custom.token_details')}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') show();
        }}
        onPointerLeave={scheduleClose}
        onFocus={show}
        onBlur={scheduleClose}
        onClick={show}
      >
        <IconInfo size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="tooltip"
            className={styles.popover}
            style={position}
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
          >
            <strong>{t('monitor_custom.token_details')}</strong>
            <dl>
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p>{t('monitor_custom.context_hint')}</p>
          </div>,
          document.body
        )}
    </div>
  );
}
