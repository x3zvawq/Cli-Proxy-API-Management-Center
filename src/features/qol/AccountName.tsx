import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { IconPencil } from '@/components/ui/icons';
import { authFilesApi } from '@/services/api/authFiles';
import type { Account } from './api';
import { accountLabel } from './display';
import styles from './AccountQuota.module.scss';

export function AccountName({ account, onChange }: { account: Account; onChange: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await authFilesApi.patchFields(account.name, { display_name: name.trim() });
      setOpen(false);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className={styles.name} title={`${account.email}\n${account.name}`}>
        <span>{accountLabel(account)}</span>
        <button
          className={styles.textButton}
          aria-label={t('qol.edit_name')}
          title={t('qol.edit_name')}
          onClick={() => {
            setName(account.display_name || '');
            setError('');
            setOpen(true);
          }}
        >
          <IconPencil size={13} />
        </button>
      </div>
      {account.display_name && (
        <small className={styles.email} title={account.email}>
          {account.email}
        </small>
      )}
      <Modal
        open={open}
        title={t('qol.edit_name')}
        onClose={() => setOpen(false)}
        closeDisabled={busy}
        footer={
          <>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <label>
          {t('qol.display_name')}
          <input
            className="input"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p>{t('qol.name_hint')}</p>
        {error && <p role="alert">{error}</p>}
      </Modal>
    </>
  );
}
