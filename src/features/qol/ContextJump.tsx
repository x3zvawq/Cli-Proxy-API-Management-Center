import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import styles from './ContextRecorder.module.scss';
import { messageOffset } from './contextDisplay';

export function ContextJump({
  current,
  total,
  onJump,
  label,
}: {
  current: number;
  total: number;
  onJump: (offset: number) => void;
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <form
      className={styles.jump}
      onSubmit={(event) => {
        event.preventDefault();
        const offset = messageOffset(
          Number(new FormData(event.currentTarget).get('position')),
          total
        );
        if (offset !== null) onJump(offset);
      }}
    >
      <label>
        {label || t('qol.context_jump_message')}
        <input
          key={current}
          name="position"
          aria-label={label || t('qol.context_jump_message')}
          type="number"
          min={1}
          max={Math.max(1, total)}
          step={1}
          required
          defaultValue={current + 1}
          disabled={!total}
        />
      </label>
      <span>/ {total}</span>
      <Button type="submit" size="sm" variant="secondary" disabled={!total}>
        {t('qol.context_jump')}
      </Button>
    </form>
  );
}
