import React, { useEffect, useId, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  children: React.ReactNode;
  showCloseButton?: boolean;
}

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const ModalWrapper: React.FC<ModalWrapperProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = 'md',
  children,
  showCloseButton = true,
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const priorFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    priorFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) || [])
      .filter((element) => !element.hasAttribute('hidden') && element.getClientRects().length > 0);

    const timer = window.setTimeout(() => {
      const autofocus = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]');
      const first = getFocusable()[0];
      (autofocus || first || dialogRef.current)?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!showCloseButton) return;
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const prior = priorFocusRef.current;
      if (prior?.isConnected) window.setTimeout(() => prior.focus(), 0);
    };
  }, [isOpen, onClose, showCloseButton]);

  if (!isOpen) return null;

  const maxWidthClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl' }[maxWidth];

  return ReactDOM.createPortal(
    <div className="ui-modal-overlay" role="presentation">
      <div className="absolute inset-0" onClick={showCloseButton ? onClose : undefined} aria-hidden="true" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`ui-modal-surface ${maxWidthClasses} z-10`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-[var(--ui-border)]">
          <div className="flex items-center gap-3 min-w-0">
            {icon && <div className="size-9 rounded-xl bg-[var(--ui-accent-soft)] text-[var(--ui-accent)] flex items-center justify-center shrink-0">{icon}</div>}
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-extrabold text-[var(--ui-text)] truncate">{title}</h2>
              {subtitle && <p className="text-xs ui-muted mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {showCloseButton && (
            <button onClick={onClose} className="ui-icon-button ui-icon-button-md" aria-label={t('accessibility.closeDialog')}>
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
};
