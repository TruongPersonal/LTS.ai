import React, { useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToasterProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'bottom-right';
}

export const Toaster: React.FC<ToasterProps> = ({
  toasts,
  onDismiss,
  position = 'top-right',
}) => {
  if (toasts.length === 0) return null;

  const positionClass =
    position === 'bottom-right'
      ? 'bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 flex-col-reverse'
      : 'top-4 right-4 left-4 sm:left-auto sm:right-6 sm:top-6 flex-col';

  return (
    <div
      className={`fixed z-[100] flex gap-2.5 pointer-events-none max-w-full sm:max-w-md sm:w-auto ${positionClass}`}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  const getStyle = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />,
          borderColor: 'border-emerald-500/30',
          badgeColor: 'bg-emerald-500/10 text-emerald-400',
        };
      case 'error':
        return {
          icon: <AlertCircle className="size-4 text-red-400 shrink-0" />,
          borderColor: 'border-red-500/30',
          badgeColor: 'bg-red-500/10 text-red-400',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="size-4 text-amber-400 shrink-0" />,
          borderColor: 'border-amber-500/30',
          badgeColor: 'bg-amber-500/10 text-amber-400',
        };
      default:
        return {
          icon: <Info className="size-4 text-[var(--ui-accent)] shrink-0" />,
          borderColor: 'border-[var(--ui-accent)]/30',
          badgeColor: 'bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]',
        };
    }
  };

  const style = getStyle();

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border bg-[var(--ui-surface)]/95 backdrop-blur-xl shadow-2xl transition-all animate-in fade-in slide-in-from-top-3 duration-250 ${style.borderColor}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`p-1 rounded-lg ${style.badgeColor}`}>{style.icon}</div>
        <p className="text-xs font-medium text-[var(--ui-text)] leading-relaxed">
          {toast.message}
        </p>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded-lg text-xs ui-muted hover:text-[var(--ui-text)] hover:bg-[var(--ui-surface-subtle)] transition-colors shrink-0"
        aria-label="Close notification"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
};
