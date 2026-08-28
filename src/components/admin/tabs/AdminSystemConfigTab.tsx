import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SystemConfig } from '../../../services/adminService';

interface AdminSystemConfigTabProps {
  systemConfig: SystemConfig | null;
  loading: boolean;
  saving: boolean;
  onSave: (quotas: SystemConfig['quotas']) => Promise<void>;
}

export const AdminSystemConfigTab: React.FC<AdminSystemConfigTabProps> = ({
  systemConfig,
  loading,
  saving,
  onSave,
}) => {
  const { t } = useTranslation();

  const [quotaFreeMin, setQuotaFreeMin] = useState(10);
  const [quotaFreeMb, setQuotaFreeMb] = useState(50);
  const [quotaProMin, setQuotaProMin] = useState(60);
  const [quotaProMb, setQuotaProMb] = useState(200);
  const [quotaMaxMin, setQuotaMaxMin] = useState(300);
  const [quotaMaxMb, setQuotaMaxMb] = useState(500);

  useEffect(() => {
    if (systemConfig) {
      setQuotaFreeMin(systemConfig.quotas.free_daily_minutes);
      setQuotaFreeMb(systemConfig.quotas.free_max_file_size_mb || 50);
      setQuotaProMin(systemConfig.quotas.pro_daily_minutes);
      setQuotaProMb(systemConfig.quotas.pro_max_file_size_mb || 200);
      setQuotaMaxMin(systemConfig.quotas.max_daily_minutes);
      setQuotaMaxMb(systemConfig.quotas.max_max_file_size_mb || 500);
    }
  }, [systemConfig]);

  const isConfigDirty = useMemo(() => {
    if (!systemConfig) return false;
    return (
      quotaFreeMin !== systemConfig.quotas.free_daily_minutes ||
      quotaFreeMb !== (systemConfig.quotas.free_max_file_size_mb || 50) ||
      quotaProMin !== systemConfig.quotas.pro_daily_minutes ||
      quotaProMb !== (systemConfig.quotas.pro_max_file_size_mb || 200) ||
      quotaMaxMin !== systemConfig.quotas.max_daily_minutes ||
      quotaMaxMb !== (systemConfig.quotas.max_max_file_size_mb || 500)
    );
  }, [
    systemConfig,
    quotaFreeMin,
    quotaFreeMb,
    quotaProMin,
    quotaProMb,
    quotaMaxMin,
    quotaMaxMb,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigDirty || saving || loading) return;
    await onSave({
      free_daily_minutes: Number(quotaFreeMin),
      free_max_file_size_mb: Number(quotaFreeMb),
      pro_daily_minutes: Number(quotaProMin),
      pro_max_file_size_mb: Number(quotaProMb),
      max_daily_minutes: Number(quotaMaxMin),
      max_max_file_size_mb: Number(quotaMaxMb),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">{t('admin.system.title')}</h2>
          <p className="text-xs ui-muted mt-0.5">{t('admin.system.quotasDesc')}</p>
        </div>

        <button
          type="submit"
          disabled={!isConfigDirty || saving || loading}
          className={`ui-button ui-button-compact self-start sm:self-auto transition-all ${
            isConfigDirty && !saving
              ? 'ui-button-primary shadow-md'
              : 'ui-button-secondary opacity-50 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>{t('admin.system.saving')}</span>
            </>
          ) : (
            <span>{t('admin.system.saveConfig')}</span>
          )}
        </button>
      </div>

      <section className="ui-card p-6 space-y-4">
        <div>
          <h3 className="text-sm font-extrabold flex items-center gap-2">
            <Zap className="size-4 text-[var(--ui-accent)]" />
            <span>{t('admin.system.quotasTitle')}</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="ui-card-flat p-4 space-y-3.5 border border-[var(--ui-border)] rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--ui-text)]">
                {t('admin.system.freeQuota')}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400 font-bold">
                Free
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold ui-muted">
                {t('admin.system.dailyMinutes')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={quotaFreeMin}
                  onChange={(e) => setQuotaFreeMin(Number(e.target.value))}
                  className="ui-input pr-16 text-xs font-semibold"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] ui-muted pointer-events-none">
                  min/day
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold ui-muted">
                {t('admin.system.maxFileSize')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={quotaFreeMb}
                  onChange={(e) => setQuotaFreeMb(Number(e.target.value))}
                  className="ui-input pr-14 text-xs font-semibold"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] ui-muted pointer-events-none">
                  MB
                </span>
              </div>
            </div>
          </div>

          <div className="ui-card-flat p-4 space-y-3.5 border border-[var(--ui-accent)]/30 bg-[var(--ui-accent-soft)]/10 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--ui-accent)]">
                {t('admin.system.proQuota')}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--ui-accent)]/10 text-[var(--ui-accent)] font-bold">
                Pro
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold ui-muted">
                {t('admin.system.dailyMinutes')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={quotaProMin}
                  onChange={(e) => setQuotaProMin(Number(e.target.value))}
                  className="ui-input pr-16 text-xs font-semibold"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] ui-muted pointer-events-none">
                  min/day
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold ui-muted">
                {t('admin.system.maxFileSize')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={4000}
                  value={quotaProMb}
                  onChange={(e) => setQuotaProMb(Number(e.target.value))}
                  className="ui-input pr-14 text-xs font-semibold"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] ui-muted pointer-events-none">
                  MB
                </span>
              </div>
            </div>
          </div>

          <div className="ui-card-flat p-4 space-y-3.5 border border-amber-500/30 bg-amber-500/5 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-500">
                {t('admin.system.maxQuota')}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 font-bold">
                Max
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold ui-muted">
                {t('admin.system.dailyMinutes')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={quotaMaxMin}
                  onChange={(e) => setQuotaMaxMin(Number(e.target.value))}
                  className="ui-input pr-16 text-xs font-semibold"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] ui-muted pointer-events-none">
                  min/day
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold ui-muted">
                {t('admin.system.maxFileSize')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={quotaMaxMb}
                  onChange={(e) => setQuotaMaxMb(Number(e.target.value))}
                  className="ui-input pr-14 text-xs font-semibold"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] ui-muted pointer-events-none">
                  MB
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ui-card p-6 space-y-4">
        <div>
          <h3 className="text-sm font-extrabold flex items-center gap-2">
            <KeyRound className="size-4 text-[var(--ui-accent)]" />
            <span>{t('admin.system.apiStatusTitle')}</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
          <div className="ui-card-flat p-4 space-y-2 border border-[var(--ui-border)]/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--ui-text)]">
                {t('admin.system.groqApi')}
              </span>
              {systemConfig?.api_status.groq_configured ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <CheckCircle2 className="size-3" />
                  <span>{t('admin.system.apiConfigured')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <AlertTriangle className="size-3" />
                  <span>{t('admin.system.apiMissing')}</span>
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-[var(--ui-text-muted)] bg-[var(--ui-bg)] px-2.5 py-1.5 rounded border border-[var(--ui-border)]/40 truncate">
              {systemConfig?.api_status.groq_key_masked || 'Chưa cấu hình GROQ_API_KEY'}
            </div>
          </div>

          <div className="ui-card-flat p-4 space-y-2 border border-[var(--ui-border)]/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--ui-text)]">
                {t('admin.system.geminiApi')}
              </span>
              {systemConfig?.api_status.gemini_configured ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <CheckCircle2 className="size-3" />
                  <span>{t('admin.system.apiConfigured')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <AlertTriangle className="size-3" />
                  <span>{t('admin.system.apiMissing')}</span>
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-[var(--ui-text-muted)] bg-[var(--ui-bg)] px-2.5 py-1.5 rounded border border-[var(--ui-border)]/40 truncate">
              {systemConfig?.api_status.gemini_key_masked || 'Chưa cấu hình GEMINI_API_KEY'}
            </div>
          </div>

          <div className="ui-card-flat p-4 space-y-2 border border-[var(--ui-border)]/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--ui-text)]">
                {t('admin.system.stripeApi')}
              </span>
              {systemConfig?.api_status.stripe_configured ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <CheckCircle2 className="size-3" />
                  <span>{t('admin.system.apiConfigured')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <AlertTriangle className="size-3" />
                  <span>{t('admin.system.apiMissing')}</span>
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-[var(--ui-text-muted)] bg-[var(--ui-bg)] px-2.5 py-1.5 rounded border border-[var(--ui-border)]/40 truncate">
              {systemConfig?.api_status.stripe_key_masked || 'Chưa cấu hình STRIPE_SECRET_KEY'}
            </div>
          </div>
        </div>
      </section>
    </form>
  );
};
