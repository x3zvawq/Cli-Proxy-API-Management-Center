import { resolvePlanTier } from '@/utils/quota/planTier';
import quotaStyles from '@/features/quota/components/QuotaBody.module.scss';
import styles from './QolPage.module.scss';

export function PlanBadge({ plan }: { plan?: string }) {
  const tier = resolvePlanTier(plan);
  const style =
    tier === 'elite'
      ? quotaStyles.elitePlanValue
      : tier === 'premium'
        ? quotaStyles.premiumPlanValue
        : styles.plusPlan;
  return <span className={`${styles.planBadge} ${style}`}>{plan || '—'}</span>;
}
