import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Languages, LogOut, Palette } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { LanguageSelector } from './LanguageSelector';
import { ThemeSelector } from './ThemeSelector';

interface UserDropdownProps {
  sidebar?: boolean;
  compact?: boolean;
}

export const UserDropdown: React.FC<UserDropdownProps> = ({ sidebar = false, compact = false }) => {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleEscape); };
  }, []);

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'LTS.ai';
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'LT';

  return (
    <div className={`relative ${sidebar ? 'sidebar-user-dropdown' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className={sidebar ? `sidebar-user-trigger ${compact ? 'sidebar-user-trigger-compact' : ''}` : 'ui-button ui-button-secondary max-w-[220px]'}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={t('accessibility.openUserMenu')}
        title={compact ? displayName : undefined}
      >
        <span className="size-8 rounded-full bg-[var(--ui-accent-soft)] text-[var(--ui-accent)] grid place-items-center text-[10px] font-black shrink-0">{initials}</span>
        {!compact && <span className="truncate flex-1 text-left">{displayName}</span>}
        {!compact && <ChevronDown className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </button>

      {isOpen && (
        <div className={`${sidebar ? 'sidebar-user-menu' : 'absolute right-0 mt-2 w-72'} ui-card overflow-hidden z-[80]`} role="menu">
          <div className="p-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface-subtle)]">
            <p className="text-sm font-bold truncate">{displayName}</p>
            <p className="text-[11px] ui-muted truncate mt-1">{profile?.email}</p>
          </div>

          <div className="p-3 border-b border-[var(--ui-border)] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold ui-muted shrink-0"><Languages className="size-4" />{t('common.language')}</span>
              <LanguageSelector compact />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold ui-muted shrink-0"><Palette className="size-4" />{t('common.theme')}</span>
              <ThemeSelector compact />
            </div>
          </div>

          <div className="p-2">
            <button type="button" role="menuitem" onClick={() => { setIsOpen(false); void signOut(); }} className="ui-button ui-button-ghost ui-danger-text w-full justify-start"><LogOut className="size-4" />{t('navigation.logout')}</button>
          </div>
        </div>
      )}
    </div>
  );
};
