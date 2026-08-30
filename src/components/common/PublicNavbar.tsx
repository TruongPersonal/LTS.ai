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
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        borderBottom: '1px solid var(--ui-border)',
        background: 'color-mix(in srgb, var(--ui-canvas) 80%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div className="ui-container min-h-16 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="LTS.ai" className="size-9 object-contain" />
          <span
            className="font-extrabold text-base tracking-tight"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            LTS.ai
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <PublicPreferencesControls />
          {onBack && (
            <button
              onClick={onBack}
              className="ui-button ui-button-ghost"
              aria-label={t('common.close')}
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          {onNext && (
            <button
              onClick={onNext}
              className="ui-button ui-button-primary ui-icon-button"
              aria-label={t('common.open')}
            >
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
