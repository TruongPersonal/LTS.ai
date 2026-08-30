import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FolderOpen, Menu, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserDropdown } from './UserDropdown';

interface AppSidebarProps {
  onHome: () => void;
  onCreateProject: () => void;
  onSearchProjects: () => void;
  editorActive?: boolean;
  activeView?: 'projects' | 'project' | 'editor';
}

const STORAGE_KEY = 'lts_sidebar_collapsed';

export const AppSidebar: React.FC<AppSidebarProps> = ({ onHome, onCreateProject, onSearchProjects, editorActive = false, activeView = 'projects' }) => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'false');
  const [mobileOpen, setMobileOpen] = useState(false);
  const effectiveCollapsed = editorActive || collapsed;
  const showLabels = !effectiveCollapsed || mobileOpen;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const run = (action: () => void) => {
    action();
    setMobileOpen(false);
  };

  const sidebar = (
    <aside className={`app-sidebar ${effectiveCollapsed ? 'app-sidebar-collapsed' : 'app-sidebar-expanded'} ${mobileOpen ? 'app-sidebar-mobile-open' : ''}`} aria-label={t('navigation.workspaceNavigation')}>
      <div className="app-sidebar-top">
        <div className="sidebar-brand pointer-events-none select-none">
          <img src="/logo.png" alt="LTS.ai" className="size-8 object-contain shrink-0" />
          {showLabels && <span className="sidebar-label font-extrabold">LTS.ai</span>}
        </div>

        <nav className="sidebar-nav" aria-label={t('navigation.workspaceNavigation')}>
          <button type="button" onClick={() => run(onHome)} className={`sidebar-nav-item ${activeView === 'projects' ? 'sidebar-nav-item-active' : ''}`} aria-label={t('navigation.dashboard')}>
            <FolderOpen className="size-[18px]" />
            {showLabels && <span className="sidebar-label">{t('navigation.dashboard')}</span>}
          </button>
          <button type="button" onClick={() => run(onCreateProject)} className="sidebar-nav-item" aria-label={t('navigation.newProject')}>
            <Plus className="size-[18px]" />
            {showLabels && <span className="sidebar-label">{t('navigation.newProject')}</span>}
          </button>
          <button type="button" onClick={() => run(onSearchProjects)} className="sidebar-nav-item" aria-label={t('navigation.searchProjects')}>
            <Search className="size-[18px]" />
            {showLabels && <span className="sidebar-label">{t('navigation.searchProjects')}</span>}
          </button>
        </nav>
      </div>

      <div className="app-sidebar-bottom">
        <UserDropdown sidebar compact={effectiveCollapsed && !mobileOpen} />
      </div>

      {!editorActive && (
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="sidebar-edge-toggle"
          aria-label={collapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')}
        >
          {collapsed ? <ChevronRight className="size-4 stroke-[2.5]" /> : <ChevronLeft className="size-4 stroke-[2.5]" />}
        </button>
      )}
    </aside>
  );

  return (
    <>
      {!mobileOpen && (
        <button type="button" className="sidebar-mobile-trigger ui-icon-button" onClick={() => setMobileOpen(true)} aria-label={t('navigation.openSidebar')}>
          <Menu className="size-4" />
        </button>
      )}
      {mobileOpen && <button className="sidebar-mobile-backdrop" type="button" aria-label={t('common.close')} onClick={() => setMobileOpen(false)} />}
      {sidebar}
    </>
  );
};
