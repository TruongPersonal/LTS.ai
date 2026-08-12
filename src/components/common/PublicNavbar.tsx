import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PublicPreferencesControls } from './PublicPreferencesControls';

interface PublicNavbarProps {
  onBack?: () => void;
  onNext?: () => void;
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({ onBack, onNext }) => {
  const { t } = useTranslation();

  return (
    <header className="border-b border-[var(--ui-border)] bg-[var(--ui-surface)]">
      <div className="ui-container min-h-16 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="LTS.ai" className="size-9 object-contain" />
          <span className="font-extrabold text-base tracking-tight">LTS.ai</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <PublicPreferencesControls />
          {onBack && (
            <button
              onClick={onBack}
              className="ui-button ui-button-ghost"
              aria-label={t('common.close')}
              title={t('common.close')}
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          {onNext && (
            <button
              onClick={onNext}
              className="ui-button ui-button-primary ui-icon-button"
              aria-label={t('common.open')}
              title={t('common.open')}
            >
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
