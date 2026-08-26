import React, { useEffect, useState } from 'react';
import { ArrowUpCircle, Check, Clock3, FileUp, Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { fileService } from '../../services/fileService';
import { stripeCheckoutService, type PaidPlan } from '../../services/stripeCheckoutService';
import {
  getPlanLimits,
  normalizePlan,
  PLAN_ORDER,
  type Plan,
} from '../../types/database';
import { formatDisplayTime } from '../../utils/time';
import { ModalWrapper } from '../common/ModalWrapper';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const currentPlan = normalizePlan(profile?.plan);
  const currentLimits = getPlanLimits(currentPlan);
  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlan);
  const [todayDuration, setTodayDuration] = useState(0);
  const [pendingPlan, setPendingPlan] = useState<PaidPlan | null>(null);
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    void fileService
      .getTodayProcessedDurationSeconds()
      .then((duration) => {
        if (active) setTodayDuration(duration);
      })
      .catch((loadError) => {
        console.error('Could not load daily subscription usage:', loadError);
        if (active) setError(t('subscription.usageLoadFailed'));
      })
      .finally(() => {
        if (active) setLoadingUsage(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, t]);

  const usagePercent = Math.min(100, Math.max(0, (todayDuration / currentLimits.dailyDurationSeconds) * 100));
  const currentMaxFileSizeMb = Math.round(currentLimits.maxFileSizeBytes / (1024 * 1024));
  const currentDailyMinutes = Math.round(currentLimits.dailyDurationSeconds / 60);
  const pendingLimits = pendingPlan ? getPlanLimits(pendingPlan) : null;
  const pendingMaxFileSizeMb = pendingLimits ? Math.round(pendingLimits.maxFileSizeBytes / (1024 * 1024)) : 0;
  const pendingDailyMinutes = pendingLimits ? Math.round(pendingLimits.dailyDurationSeconds / 60) : 0;

  const handleSelectPlan = (plan: Plan) => {
    if (plan === 'free' || plan === currentPlan || PLAN_ORDER.indexOf(plan) <= currentPlanIndex) return;
    setPendingPlan(plan as PaidPlan);
    setError(null);
  };

  const handleConfirmUpgrade = async () => {
    if (!pendingPlan) return;

    setSaving(true);
    setError(null);
    try {
      const checkoutUrl = await stripeCheckoutService.createSession(pendingPlan);
      window.location.assign(checkoutUrl);
    } catch (upgradeError) {
      console.error('Could not start Stripe Checkout:', upgradeError);
      setError(t('subscription.checkoutFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCheckoutConfirm = () => {
    if (!pendingPlan || saving) return;
    setError(null);
    setCheckoutConfirmOpen(true);
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={t('subscription.title')}
      subtitle={t('subscription.subtitle')}
      icon={<ArrowUpCircle className="size-4" />}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {error && <div className="ui-status-error p-3 text-xs" role="alert">{error}</div>}

        <section className="rounded-2xl border border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] ui-muted uppercase tracking-[0.12em]">{t('subscription.currentPlan')}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-xl font-extrabold tracking-[-0.02em]">{t(`subscription.plans.${currentPlan}.name`)}</p>
                <span className="ui-badge ui-badge-accent ui-badge-compact">{t('subscription.currentPlan')}</span>
              </div>
            </div>
            <div className="size-10 rounded-xl bg-[var(--ui-surface)]/70 border border-[var(--ui-border)] grid place-items-center shrink-0">
              <Sparkles className="size-5 text-[var(--ui-accent)]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-xl bg-[var(--ui-surface)]/70 border border-[var(--ui-border)] p-3 flex items-start gap-2.5 min-w-0">
              <FileUp className="size-4 text-[var(--ui-accent)] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="ui-muted">{t('subscription.fileLimitLabel')}</p>
                <p className="font-bold mt-1 text-[11px] leading-snug">{t('subscription.fileLimit', { size: currentMaxFileSizeMb })}</p>
              </div>
            </div>
            <div className="rounded-xl bg-[var(--ui-surface)]/70 border border-[var(--ui-border)] p-3 flex items-start gap-2.5 min-w-0">
              <Clock3 className="size-4 text-[var(--ui-accent)] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="ui-muted">{t('subscription.dailyLimitLabel')}</p>
                <p className="font-bold mt-1 text-[11px] leading-snug">{t('subscription.dailyLimit', { minutes: currentDailyMinutes })}</p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="ui-muted">{t('subscription.dailyUsage')}</span>
              <span className="font-semibold">
                {loadingUsage ? '...' : t('subscription.dailyUsageValue', {
                  used: formatDisplayTime(todayDuration),
                  limit: formatDisplayTime(currentLimits.dailyDurationSeconds),
                })}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--ui-surface)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--ui-accent)] transition-[width]" style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        </section>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold">{t('subscription.choosePlan')}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 items-stretch">
            {PLAN_ORDER.map((plan) => {
              const limits = getPlanLimits(plan);
              const isCurrent = plan === currentPlan;
              const canUpgrade = PLAN_ORDER.indexOf(plan) > currentPlanIndex;
              const maxFileSizeMb = Math.round(limits.maxFileSizeBytes / (1024 * 1024));
              const dailyMinutes = Math.round(limits.dailyDurationSeconds / 60);

              return (
                <div
                  key={plan}
                  className={`rounded-2xl border p-4 flex flex-col gap-3 ${isCurrent ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-soft)]' : 'border-[var(--ui-border)] bg-[var(--ui-surface-subtle)]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-extrabold">{t(`subscription.plans.${plan}.name`)}</p>
                    {isCurrent && <Check className="size-4 text-[var(--ui-accent)] shrink-0" />}
                  </div>
                  <p className="text-[11px] ui-muted leading-relaxed min-h-[3.5rem]">{t(`subscription.plans.${plan}.description`)}</p>
                  <div className="text-xs space-y-2">
                    <div className="flex items-start gap-2">
                      <FileUp className="size-3.5 ui-muted shrink-0 mt-0.5" />
                      <span>{t('subscription.fileLimit', { size: maxFileSizeMb })}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock3 className="size-3.5 ui-muted shrink-0 mt-0.5" />
                      <span>{t('subscription.dailyLimit', { minutes: dailyMinutes })}</span>
                    </div>
                  </div>
                  <div className="mt-auto pt-1">
                    {isCurrent || !canUpgrade ? (
                      <div className="ui-badge w-full justify-center min-h-[38px]">{isCurrent ? t('subscription.currentPlan') : t('subscription.included')}</div>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSelectPlan(plan)}
                        className="ui-button ui-button-primary w-full text-xs min-h-[38px]"
                      >
                        {t('subscription.upgradeAction')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {pendingPlan && pendingLimits && (
          <section className="rounded-2xl border border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] p-4 sm:p-5 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="size-4 text-[var(--ui-accent)] shrink-0" />
                  <p className="text-sm font-extrabold">{t('subscription.checkoutTitle')}</p>
                </div>
                <p className="text-xs ui-muted mt-1">{t('subscription.checkoutDescription')}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="ui-badge ui-badge-accent">{t(`subscription.plans.${pendingPlan}.name`)}</span>
                <span className="ui-badge">{t('subscription.fileLimit', { size: pendingMaxFileSizeMb })}</span>
                <span className="ui-badge">{t('subscription.dailyLimit', { minutes: pendingDailyMinutes })}</span>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <button type="button" className="ui-button ui-button-secondary w-full sm:w-auto" onClick={() => setPendingPlan(null)} disabled={saving}>
                {t('common.cancel')}
              </button>
              <button type="button" className="ui-button ui-button-primary w-full sm:w-auto" onClick={handleOpenCheckoutConfirm} disabled={saving}>
                {t('subscription.checkoutAction')}
              </button>
            </div>
          </section>
        )}

        {pendingPlan && pendingLimits && (
          <ModalWrapper
            isOpen={checkoutConfirmOpen}
            onClose={() => {
              if (!saving) setCheckoutConfirmOpen(false);
            }}
            title={t('subscription.checkoutTitle')}
            icon={<ArrowUpCircle className="size-4" />}
            maxWidth="sm"
          >
            <div className="space-y-5">
              <div>
                <p className="text-sm ui-muted leading-relaxed">{t('subscription.checkoutDescription')}</p>
              </div>
              {error && <div className="ui-status-error p-3 text-xs" role="alert">{error}</div>}
              <div className="flex flex-wrap gap-2">
                <span className="ui-badge ui-badge-accent">{t(`subscription.plans.${pendingPlan}.name`)}</span>
                <span className="ui-badge">{t('subscription.fileLimit', { size: pendingMaxFileSizeMb })}</span>
                <span className="ui-badge">{t('subscription.dailyLimit', { minutes: pendingDailyMinutes })}</span>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-4 border-t border-[var(--ui-border)]">
                <button
                  type="button"
                  className="ui-button ui-button-secondary w-full sm:w-auto"
                  onClick={() => setCheckoutConfirmOpen(false)}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </button>
                <button
                  data-autofocus
                  type="button"
                  className="ui-button ui-button-primary w-full sm:w-auto"
                  onClick={() => void handleConfirmUpgrade()}
                  disabled={saving}
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {t('subscription.checkoutAction')}
                </button>
              </div>
            </div>
          </ModalWrapper>
        )}
      </div>
    </ModalWrapper>
  );
};
