import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IconChevronDown } from '@/components/ui/icons';
import styles from './QuotaColumnMenu.module.scss';

export function QuotaColumnMenu({
  options,
  hidden,
  onToggle,
}: {
  options: { id: string; label: string }[];
  hidden: string[];
  onToggle: (id: string, visible: boolean) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  return (
    <>
      <button
        className={styles.trigger}
        popoverTarget={id}
        aria-label={t('qol.visible_quotas')}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (!menu.current) return;
          menu.current.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 288))}px`;
          menu.current.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 280))}px`;
        }}
      >
        {t('qol.quota')} <IconChevronDown size={14} />
      </button>
      <div id={id} ref={menu} popover="auto" className={styles.menu}>
        <strong>{t('qol.visible_quotas')}</strong>
        {options.map((option) => (
          <label key={option.id}>
            <input
              type="checkbox"
              checked={!hidden.includes(option.id)}
              onChange={(event) => onToggle(option.id, event.target.checked)}
            />
            {option.label}
          </label>
        ))}
        {!options.length && <p>{t('qol.empty')}</p>}
      </div>
    </>
  );
}
