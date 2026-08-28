import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, CheckCircle2, Clock3, Crown, FileUp, Sparkles, Zap } from 'lucide-react';
import { ModalWrapper } from '../common/ModalWrapper';
import { usePlanLimits } from '../../hooks/usePlanLimits';
import type { Plan } from '../../types/database';

interface CheckoutSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan;
}

export const CheckoutSuccessModal: React.FC<CheckoutSuccessModalProps> = ({
  isOpen,
  onClose,
  plan,
}) => {
  const { t } = useTranslation();
  const planLimitsMap = usePlanLimits();
  const limits = planLimitsMap[plan];
  const maxFileSizeMb = Math.round(limits.maxFileSizeBytes / (1024 * 1024));
  const dailyMinutes = Math.round(limits.dailyDurationSeconds / 60);

  const isMax = plan === 'max';

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={t('subscription.successModal.title')}
      subtitle={t('subscription.successModal.subtitle')}
      icon={<Sparkles className="size-4 text-[var(--ui-accent)]" />}
      maxWidth="sm"
    >
      <div className="space-y-6 pt-2 text-center">
        {}
        <div className="relative mx-auto size-16 rounded-2xl bg-[var(--ui-accent-soft)] border border-[var(--ui-accent)]/40 flex items-center justify-center shadow-md">
          {isMax ? (
            <Crown className="size-8 text-[var(--ui-accent)] animate-bounce" />
          ) : (
            <Zap className="size-8 text-[var(--ui-accent)] animate-pulse" />
          )}
          <div className="absolute -top-1.5 -right-1.5 size-6 rounded-full bg-[var(--ui-success)] text-[var(--ui-bg)] grid place-items-center shadow-xs">
            <CheckCircle2 className="size-4" />
          </div>
        </div>

        <div>
          <h3 className="text-xl font-black tracking-tight text-[var(--ui-text)]">
            {t('subscription.successModal.greeting', {
              plan: t(`subscription.plans.${plan}.name`),
            })}
          </h3>
          <p className="text-xs ui-muted mt-1.5 leading-relaxed">
            {t('subscription.successModal.description')}
          </p>
        </div>

        {}
        <div className="rounded-2xl border border-[var(--ui-accent)]/30 bg-[var(--ui-surface-subtle)] p-4 space-y-3 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ui-text)]">
              {t('subscription.successModal.benefitsTitle')}
            </span>
            <span className="ui-badge ui-badge-accent font-bold text-xs">
              {t(`subscription.plans.${plan}.name`)}
            </span>
          </div>

          <div className="space-y-2 text-xs pt-1 border-t border-[var(--ui-border)]/60">
            <div className="flex items-center gap-2.5">
              <div className="size-5 rounded-md bg-[var(--ui-surface)] grid place-items-center shrink-0">
                <FileUp className="size-3.5 text-[var(--ui-accent)]" />
              </div>
              <span className="font-semibold text-[var(--ui-text)]">
                {t('subscription.fileLimitCompact', { size: maxFileSizeMb })}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="size-5 rounded-md bg-[var(--ui-surface)] grid place-items-center shrink-0">
                <Clock3 className="size-3.5 text-[var(--ui-accent)]" />
              </div>
              <span className="font-semibold text-[var(--ui-text)]">
                {t('subscription.dailyLimitCompact', { minutes: dailyMinutes })}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="size-5 rounded-md bg-[var(--ui-surface)] grid place-items-center shrink-0">
                <Calendar className="size-3.5 text-[var(--ui-accent)]" />
              </div>
              <span className="font-medium ui-muted">
                {t('subscription.successModal.duration')}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="ui-button ui-button-primary w-full font-bold py-3 text-sm flex items-center justify-center gap-2 shadow-sm"
        >
          <Sparkles className="size-4" />
          <span>{t('subscription.successModal.action')}</span>
        </button>
      </div>
    </ModalWrapper>
  );
};
