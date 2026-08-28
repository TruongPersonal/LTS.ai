import React from 'react';
import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdminTab } from './AdminSidebar';

interface AdminHeaderProps {
  activeTab: AdminTab;
  onToggleMobileMenu?: () => void;
}

const TAB_TITLES: Record<AdminTab, string> = {
  overview: 'admin.tabs.overview',
  users: 'admin.tabs.users',
  projects: 'admin.tabs.projects',
  system: 'admin.tabs.system',
  audit_logs: 'admin.tabs.auditLogs',
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({ activeTab, onToggleMobileMenu }) => {
  const { t } = useTranslation();

  const tabTitle = t(TAB_TITLES[activeTab]);

  return (
    <header className="h-16 shrink-0 bg-[var(--ui-surface)]/80 backdrop-blur-md border-b border-[var(--ui-border)] sticky top-0 z-20">
      <div className="max-w-7xl h-full mx-auto px-4 sm:px-6 md:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="md:hidden inline-flex items-center justify-center size-9 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-subtle)] text-[var(--ui-text)] transition-colors shrink-0"
              aria-label={t('navigation.openSidebar')}
            >
              <Menu className="size-4.5" />
            </button>
          )}
          <div className="flex items-center gap-2 text-xs ui-muted min-w-0">
            <span className="font-semibold shrink-0">{t('admin.title', 'Quản trị')}</span>
            <span className="opacity-40 shrink-0">/</span>
            <h1 className="text-sm font-bold text-[var(--ui-text)] tracking-tight truncate">
              {tabTitle}
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
};
