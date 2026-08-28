import React from 'react';
import { Cpu, FolderKanban, LayoutDashboard, ScrollText, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserDropdown } from '../common/UserDropdown';

export type AdminTab = 'overview' | 'users' | 'projects' | 'system' | 'audit_logs';

interface AdminSidebarProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onSelectTab,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const { t } = useTranslation();

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'overview',
      label: t('admin.tabs.overview'),
      icon: <LayoutDashboard className="size-[18px]" />,
    },
    {
      id: 'users',
      label: t('admin.tabs.users'),
      icon: <Users className="size-[18px]" />,
    },
    {
      id: 'projects',
      label: t('admin.tabs.projects'),
      icon: <FolderKanban className="size-[18px]" />,
    },
    {
      id: 'system',
      label: t('admin.tabs.system'),
      icon: <Cpu className="size-[18px]" />,
    },
    {
      id: 'audit_logs',
      label: t('admin.tabs.auditLogs'),
      icon: <ScrollText className="size-[18px]" />,
    },
  ];

  const handleSelect = (tab: AdminTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          role="button"
          tabIndex={0}
          onClick={onCloseMobile}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onCloseMobile?.();
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          aria-label={t('navigation.collapseSidebar')}
        />
      )}

      <aside
        className={`app-sidebar app-sidebar-expanded ${
          mobileOpen ? 'app-sidebar-mobile-open !z-50' : ''
        }`}
        aria-label={t('admin.tabs.navLabel')}
      >
        <div className="app-sidebar-top">
          {/* Brand Header */}
          <div className="sidebar-brand pointer-events-none select-none">
            <img src="/logo.png" alt="LTS.ai" className="size-8 object-contain shrink-0" />
            <span className="sidebar-label font-extrabold text-base">LTS.ai</span>
          </div>

          {/* Navigation */}
          <nav className="sidebar-nav" aria-label={t('admin.tabs.navLabel')}>
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item-active' : ''}`}
                  aria-label={item.label}
                >
                  {item.icon}
                  <span className="sidebar-label">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile dropdown (hidePlan) */}
        <div className="app-sidebar-bottom">
          <UserDropdown sidebar compact={false} hidePlan />
        </div>
      </aside>
    </>
  );
};
