import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserDropdown } from './UserDropdown';

interface NavbarProps {
  onHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onHome }) => {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-50 bg-[var(--ui-surface)] border-b border-[var(--ui-border)]">
      <div className="ui-container h-16 flex items-center justify-between gap-3">
        <button type="button" className="flex items-center gap-2.5 cursor-pointer bg-transparent border-0 p-0 ui-focus-ring" onClick={onHome} title={t('navigation.backProjects')}>
          <img src="/logo.png" alt="LTS.ai" className="size-9 object-contain" />
          <span className="text-base font-extrabold tracking-tight text-[var(--ui-text)]">LTS.ai</span>
        </button>
        <UserDropdown />
      </div>
    </header>
  );
};
