import React from 'react';
import { AlertTriangle, CheckCircle2, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SystemConfig } from '../../../services/adminService';

interface ApiKeyStatusSectionProps {
  systemConfig: SystemConfig | null;
}

export const ApiKeyStatusSection: React.FC<ApiKeyStatusSectionProps> = ({ systemConfig }) => {
  const { t } = useTranslation();

  return (
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
  );
};
