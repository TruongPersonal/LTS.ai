import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SystemConfig } from '../../../services/adminService';
import { ApiKeyStatusSection } from '../system/ApiKeyStatusSection';
import { QuotaTierInputCard } from '../system/QuotaTierInputCard';

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
          <QuotaTierInputCard
            title={t('admin.system.freeQuota')}
            badgeLabel="Free"
            badgeClassName="bg-slate-500/10 text-slate-400"
            cardClassName="border border-[var(--ui-border)]"
            dailyMinutes={quotaFreeMin}
            maxFileSizeMb={quotaFreeMb}
            maxFileSizeLimit={2000}
            onDailyMinutesChange={setQuotaFreeMin}
            onMaxFileSizeMbChange={setQuotaFreeMb}
          />

          <QuotaTierInputCard
            title={t('admin.system.proQuota')}
            badgeLabel="Pro"
            badgeClassName="bg-[var(--ui-accent)]/10 text-[var(--ui-accent)]"
            cardClassName="border border-[var(--ui-accent)]/30 bg-[var(--ui-accent-soft)]/10"
            titleClassName="text-[var(--ui-accent)]"
            dailyMinutes={quotaProMin}
            maxFileSizeMb={quotaProMb}
            maxFileSizeLimit={4000}
            onDailyMinutesChange={setQuotaProMin}
            onMaxFileSizeMbChange={setQuotaProMb}
          />

          <QuotaTierInputCard
            title={t('admin.system.maxQuota')}
            badgeLabel="Max"
            badgeClassName="bg-amber-500/10 text-amber-500"
            cardClassName="border border-amber-500/30 bg-amber-500/5"
            titleClassName="text-amber-500"
            dailyMinutes={quotaMaxMin}
            maxFileSizeMb={quotaMaxMb}
            maxFileSizeLimit={10000}
            onDailyMinutesChange={setQuotaMaxMin}
            onMaxFileSizeMbChange={setQuotaMaxMb}
          />
        </div>
      </section>

      <ApiKeyStatusSection systemConfig={systemConfig} />
    </form>
  );
};
