import React, { useEffect, useState } from 'react';
import { ArrowUpCircle, Check, Clock3, CreditCard, Crown, FileUp, Loader2, Sparkles, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { usePlanLimits } from '../../hooks/usePlanLimits';
import { fileService } from '../../services/fileService';
import { stripeCheckoutService, type PaidPlan } from '../../services/stripeCheckoutService';
import { systemService } from '../../services/systemService';
import {
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
  const planLimits = usePlanLimits();
  const currentPlan = normalizePlan(profile?.plan);
  const currentLimits = planLimits[currentPlan];
  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlan);
  const [todayDuration, setTodayDuration] = useState(0);
  const [pendingPlan, setPendingPlan] = useState<PaidPlan | null>(null);
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    void systemService.fetchAndApplyQuotas();

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
  }, [isOpen]);

  const usagePercent = Math.min(100, Math.max(0, (todayDuration / currentLimits.dailyDurationSeconds) * 100));
  const pendingLimits = pendingPlan ? planLimits[pendingPlan] : null;
  const pendingMaxFileSizeMb = pendingLimits ? Math.round(pendingLimits.maxFileSizeBytes / (1024 * 1024)) : 0;
  const pendingDailyMinutes = pendingLimits ? Math.round(pendingLimits.dailyDurationSeconds / 60) : 0;

  const getExpirationInfo = () => {
    if (currentPlan === 'free' || !profile?.plan_expires_at) return null;
    const expDate = new Date(profile.plan_expires_at);
    if (Number.isNaN(expDate.getTime())) return null;
    const diffMs = expDate.getTime() - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    return {
      formattedDate: expDate.toLocaleDateString(),
      daysRemaining,
    };
  };

  const expirationInfo = getExpirationInfo();

  const handleSelectPlan = (plan: Plan) => {
    if (plan === 'free' || plan === currentPlan || PLAN_ORDER.indexOf(plan) <= currentPlanIndex) return;
    setPendingPlan(plan as PaidPlan);
    setError(null);
    setCheckoutConfirmOpen(true);
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

  const getPlanIcon = (plan: Plan) => {
    switch (plan) {
      case 'pro':
        return <Zap className="size-5 text-[var(--ui-accent)]" />;
      case 'max':
        return <Crown className="size-5 text-[var(--ui-accent)]" />;
      default:
        return <Sparkles className="size-5 text-[var(--ui-muted)]" />;
    }
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

        <section className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-4 sm:p-4.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 font-medium">
              <Clock3 className="size-4 text-[var(--ui-accent)] shrink-0" />
              <span>{t('subscription.dailyUsage')}</span>
              {expirationInfo && (
                <span className="ui-muted text-[11px] font-normal border-l border-[var(--ui-border)] pl-2">
                  {t('subscription.expiresOn', { date: expirationInfo.formattedDate, days: expirationInfo.daysRemaining })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">
                {loadingUsage ? '...' : t('subscription.dailyUsageValue', {
                  used: formatDisplayTime(todayDuration),
                  limit: formatDisplayTime(currentLimits.dailyDurationSeconds),
                })}
              </span>
              <span className="ui-badge ui-badge-accent ui-badge-compact font-mono text-[10px]">
                {Math.round(usagePercent)}%
              </span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-[var(--ui-surface)] border border-[var(--ui-border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--ui-accent)] transition-[width] duration-300"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </section>

        <div className="space-y-3.5">
          <div className="flex items-end justify-between gap-3">
            <p className="text-sm font-bold tracking-tight">{t('subscription.choosePlan')}</p>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-3 items-stretch">
            {PLAN_ORDER.map((plan) => {
              const limits = planLimits[plan];
              const isCurrent = plan === currentPlan;
              const canUpgrade = PLAN_ORDER.indexOf(plan) > currentPlanIndex;
              const maxFileSizeMb = Math.round(limits.maxFileSizeBytes / (1024 * 1024));
              const dailyMinutes = Math.round(limits.dailyDurationSeconds / 60);

              return (
                <div
                  key={plan}
                  className={`rounded-2xl border p-5 flex flex-col gap-3.5 transition-all duration-200 ${
                    isCurrent
                      ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-soft)]/60 shadow-sm'
                      : canUpgrade
                        ? 'border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] hover:border-[var(--ui-border-hover)] hover:bg-[var(--ui-surface)]'
                        : 'border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-lg bg-[var(--ui-surface)] border border-[var(--ui-border)] grid place-items-center shrink-0">
                        {getPlanIcon(plan)}
                      </div>
                      <div>
                        <p className="text-lg font-black tracking-tight">{t(`subscription.plans.${plan}.name`)}</p>
                      </div>
                    </div>
                    {isCurrent && <Check className="size-4 text-[var(--ui-accent)] shrink-0" />}
                  </div>

                  <p className="text-xs ui-muted leading-relaxed min-h-[3rem]">{t(`subscription.plans.${plan}.description`)}</p>

                  <div className="text-xs space-y-2.5 py-2.5 border-t border-b border-[var(--ui-border)]/70">
                    <div className="flex items-center gap-2.5">
                      <div className="size-5 rounded-md bg-[var(--ui-surface)] grid place-items-center shrink-0">
                        <FileUp className="size-3.5 text-[var(--ui-accent)]" />
                      </div>
                      <span className="font-medium">{t('subscription.fileLimit', { size: maxFileSizeMb })}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="size-5 rounded-md bg-[var(--ui-surface)] grid place-items-center shrink-0">
                        <Clock3 className="size-3.5 text-[var(--ui-accent)]" />
                      </div>
                      <span className="font-medium">{t('subscription.dailyLimit', { minutes: dailyMinutes })}</span>
                    </div>
                  </div>

                  <div className="mt-auto pt-1">
                    {isCurrent || !canUpgrade ? (
                      <div className="ui-badge w-full justify-center min-h-[42px] font-semibold text-xs">{isCurrent ? t('subscription.currentPlan') : t('subscription.included')}</div>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSelectPlan(plan)}
                        className="ui-button ui-button-primary w-full text-xs sm:text-sm font-bold min-h-[42px] transition-transform active:scale-[0.98]"
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
          <ModalWrapper
            isOpen={checkoutConfirmOpen}
            onClose={() => {
              if (!saving) setCheckoutConfirmOpen(false);
            }}
            title={t('subscription.checkoutTitle')}
            subtitle={`${t(`subscription.plans.${pendingPlan}.name`)} · ${t('subscription.fileLimitCompact', { size: pendingMaxFileSizeMb })} · ${t('subscription.dailyLimitCompact', { minutes: pendingDailyMinutes })}`}
            icon={<CreditCard className="size-4" />}
            maxWidth="sm"
          >
            <div className="space-y-5">
              <div>
                <p className="text-sm ui-muted leading-relaxed">{t('subscription.checkoutDescription')}</p>
              </div>

              {error && <div className="ui-status-error p-3 text-xs" role="alert">{error}</div>}

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
