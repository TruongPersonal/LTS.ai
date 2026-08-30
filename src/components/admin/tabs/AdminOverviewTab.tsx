import React, { useMemo } from 'react';
import { Activity, DollarSign, RefreshCw, Users, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdminOverview } from '../../../services/adminService';
import { PLAN_ORDER, type Plan } from '../../../types/database';
import { formatAdminDuration } from '../../../utils/time';

interface AdminOverviewTabProps {
  overview: AdminOverview | null;
  loading: boolean;
  onRefresh: () => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  overview,
  loading,
  onRefresh,
}) => {
  const { t } = useTranslation();

  const planNames = useMemo(
    () =>
      Object.fromEntries(
        PLAN_ORDER.map((plan) => [plan, t(`subscription.plans.${plan}.name`)])
      ) as Record<Plan, string>,
    [t]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {t('admin.tabs.overview')}
          </h2>
          <p className="text-xs ui-muted mt-0.5">{t('admin.description')}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="ui-button ui-button-secondary ui-button-compact w-full sm:w-auto justify-center"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('admin.refresh')}</span>
        </button>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="ui-card p-5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold ui-muted">{t('admin.revenue.title')}</span>
            <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <DollarSign className="size-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-500">
            {loading
              ? '—'
              : `$${Number(overview?.revenue.estimated_mrr ?? 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
          </div>
          <div className="text-[11px] ui-muted flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span>{t('admin.revenue.stripeEstimate')}</span>
          </div>
        </div>

        <div className="ui-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold ui-muted">{t('admin.metrics.users')}</span>
            <div className="size-8 rounded-xl bg-[var(--ui-accent-soft)] text-[var(--ui-accent)] flex items-center justify-center">
              <Users className="size-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold">
            {loading ? '—' : overview?.users.total ?? 0}
          </div>
          <div className="text-[11px] ui-muted flex gap-2">
            <span>Free: {overview?.users.by_plan.free ?? 0}</span>
            <span>·</span>
            <span className="text-[var(--ui-accent)] font-semibold">
              Pro: {overview?.users.by_plan.pro ?? 0}
            </span>
            <span>·</span>
            <span className="text-amber-500 font-semibold">
              Max: {overview?.users.by_plan.max ?? 0}
            </span>
          </div>
        </div>

        <div className="ui-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold ui-muted">{t('admin.metrics.totalDuration')}</span>
            <div className="size-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Activity className="size-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold">
            {loading ? '—' : formatAdminDuration(overview?.files.total_processed_seconds)}
          </div>
          <div className="text-[11px] ui-muted">
            {t('admin.metrics.projects')}: {overview?.projects.total ?? 0}
          </div>
        </div>

        <div className="ui-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold ui-muted">{t('admin.metrics.successRate')}</span>
            <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Zap className="size-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-indigo-400">
            {loading ? '—' : `${overview?.files.success_rate ?? 100}%`}
          </div>
          <div className="text-[11px] ui-muted flex items-center gap-1.5">
            <span className="text-emerald-500 font-semibold">
              {t('admin.metrics.completed')}: {overview?.files.completed ?? 0}
            </span>
            <span>·</span>
            <span className="text-[var(--ui-danger)] font-semibold">
              {t('admin.metrics.failed')}: {overview?.files.failed ?? 0}
            </span>
          </div>
        </div>
      </section>

      <section className="ui-card p-6 space-y-4">
        <h3 className="text-sm font-extrabold">{t('admin.metrics.planBreakdown')}</h3>
        <div className="space-y-3">
          {PLAN_ORDER.map((plan) => {
            const count = overview?.users.by_plan[plan] ?? 0;
            const total = overview?.users.total || 1;
            const percent = Math.round((count / total) * 100);
            return (
              <div key={plan} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span>{planNames[plan]}</span>
                  <span className="ui-muted">
                    {count} user ({percent}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--ui-surface-subtle)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      plan === 'max'
                        ? 'bg-amber-500'
                        : plan === 'pro'
                          ? 'bg-[var(--ui-accent)]'
                          : 'bg-slate-400'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
