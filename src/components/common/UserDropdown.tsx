import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Languages, Loader2, LogOut, Palette, Pencil, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { LanguageSelector } from './LanguageSelector';
import { ThemeSelector } from './ThemeSelector';

interface UserDropdownProps {
  sidebar?: boolean;
  compact?: boolean;
}

export const UserDropdown: React.FC<UserDropdownProps> = ({ sidebar = false, compact = false }) => {
  const { t } = useTranslation();
  const { profile, updateProfile, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'User';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditingName(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsEditingName(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleStartEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    setNameDraft(displayName);
    setIsEditingName(true);
  };

  const handleSaveName = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === displayName) {
      setIsEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      await updateProfile({ full_name: trimmed });
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update name:', err);
    } finally {
      setSavingName(false);
    }
  };

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
        <span className="size-8 rounded-full bg-[var(--ui-surface-subtle)] border border-[var(--ui-border)] text-[var(--ui-text-muted)] grid place-items-center shrink-0 shadow-xs">
          <User className="size-4" />
        </span>
        {!compact && <span className="truncate flex-1 text-left font-bold">{displayName}</span>}
        {!compact && <ChevronDown className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </button>

      {isOpen && (
        <div className={`${sidebar ? 'sidebar-user-menu' : 'absolute right-0 mt-2 w-72'} ui-card overflow-hidden z-[80]`} role="menu">
          <div className="p-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface-subtle)]">
            {isEditingName ? (
              <form onSubmit={handleSaveName} className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                <input
                  type="text"
                  autoFocus
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setIsEditingName(false);
                  }}
                  className="ui-input text-xs font-bold py-1 px-2.5 flex-1"
                />
                <button
                  type="submit"
                  disabled={savingName}
                  className="ui-icon-button ui-icon-button-sm text-[var(--ui-success)] shrink-0"
                  title={t('common.save')}
                  aria-label={t('common.save')}
                >
                  {savingName ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  disabled={savingName}
                  className="ui-icon-button ui-icon-button-sm ui-muted shrink-0"
                  title={t('common.cancel')}
                  aria-label={t('common.cancel')}
                >
                  <X className="size-3.5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-2 group">
                <p className="text-sm font-bold truncate flex-1">{displayName}</p>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="ui-icon-button ui-icon-button-sm ui-muted opacity-70 group-hover:opacity-100 shrink-0"
                  title={t('common.edit')}
                  aria-label={t('common.edit')}
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
            <p className="text-[11px] ui-muted truncate mt-1 font-mono">{profile?.email}</p>
          </div>

          <div className="p-3 border-b border-[var(--ui-border)] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold ui-muted shrink-0">
                <Languages className="size-4" />
                {t('common.language')}
              </span>
              <LanguageSelector compact />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold ui-muted shrink-0">
                <Palette className="size-4" />
                {t('common.theme')}
              </span>
              <ThemeSelector compact />
            </div>
          </div>

          <div className="p-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                void signOut();
              }}
              className="ui-button ui-button-ghost ui-danger-text w-full justify-start"
            >
              <LogOut className="size-4" />
              {t('navigation.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
