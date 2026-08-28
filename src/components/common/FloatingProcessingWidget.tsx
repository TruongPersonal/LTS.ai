import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, AlertCircle, Check, ChevronUp, Loader2, X } from 'lucide-react';
import { useGlobalProcessing } from '../../hooks/useGlobalProcessing';

export const FloatingProcessingWidget: React.FC = () => {
  const { t } = useTranslation();
  const {
    isProcessing,
    activeItem,
    completedCount,
    failedCount,
    totalCount,
    activePercent,
    isWidgetVisible,
  } = useGlobalProcessing();

  const [expanded, setExpanded] = useState(false);

  if (!isWidgetVisible || totalCount === 0) return null;

  const processedCount = completedCount + failedCount;
  const isAllDone = !isProcessing && processedCount >= totalCount;
  
  const isAllSuccess = isAllDone && completedCount > 0 && failedCount === 0;
  const isPartialSuccess = isAllDone && completedCount > 0 && failedCount > 0;
  const isAllFailed = isAllDone && completedCount === 0 && failedCount > 0;

  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (activePercent / 100) * circumference;

  const getRingStroke = () => {
    if (isAllFailed) return 'var(--ui-danger)';
    if (isPartialSuccess) return 'var(--ui-warning)';
    return 'url(#studio-floating-grad)';
  };

  return (
    <aside
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5 font-sans select-none"
      aria-label="Tiến trình xử lý toàn cục"
    >
      {}
      {expanded && (
        <div
          className="w-72 p-3.5 rounded-2xl border border-[var(--ui-border-strong)] bg-[var(--ui-surface)]/95 backdrop-blur-xl shadow-2xl space-y-2.5 animate-in fade-in zoom-in-95 duration-200"
          role="region"
          aria-live="polite"
        >
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded-md bg-[var(--ui-accent)]/10 text-[var(--ui-accent)]">
              <Activity className="size-3.5" />
            </span>
            <h4 className="text-xs font-bold text-[var(--ui-text)]">
              {isAllDone ? t('common.saved') : `${processedCount}/${totalCount}`}
            </h4>
          </div>

          {activeItem && isProcessing && (
            <div className="space-y-1.5 pt-1 border-t border-[var(--ui-border-subtle)]">
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-xs font-semibold text-[var(--ui-text)] truncate flex-1"
                  title={activeItem.file.file_name}
                >
                  {activeItem.file.file_name}
                </p>
                <span className="font-mono font-bold text-xs text-[var(--ui-accent)] shrink-0">
                  {activePercent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-[var(--ui-surface-muted)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{
                    background: 'var(--cosmic-gradient)',
                    width: `${activePercent}%`,
                  }}
                />
              </div>
            </div>
          )}

          {isAllSuccess && (
            <div className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-[var(--ui-success)]">
              <Check className="size-4" />
              <span>{t('processing.allCompleted', { count: totalCount })}</span>
            </div>
          )}

          {isPartialSuccess && (
            <div className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-[var(--ui-warning)]">
              <AlertCircle className="size-4" />
              <span>{t('processing.partialCompleted', { total: totalCount, failed: failedCount })}</span>
            </div>
          )}

          {isAllFailed && (
            <div className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-[var(--ui-danger)]">
              <X className="size-4 stroke-[2.5]" />
              <span>{t('processing.allFailed', { count: totalCount })}</span>
            </div>
          )}
        </div>
      )}

      {}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="group relative flex items-center justify-center size-14 rounded-full border border-[var(--ui-border-strong)] bg-[var(--ui-surface)]/95 backdrop-blur-xl shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
        title={isAllDone ? t('processing.doneTitle') : `${processedCount}/${totalCount}`}
        aria-label={t('processing.progressAria', { processed: processedCount, total: totalCount })}
      >
        {}
        <svg className="absolute inset-0 size-14 -rotate-90" viewBox="0 0 56 56">
          <circle
            cx="28"
            cy="28"
            r={radius}
            className="stroke-[var(--ui-border-subtle)]"
            strokeWidth="3"
            fill="transparent"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke={getRingStroke()}
            strokeWidth="3"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={isAllDone ? 0 : strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />
          <defs>
            <linearGradient id="studio-floating-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>
          </defs>
        </svg>

        {}
        <div className="relative z-10 flex flex-col items-center justify-center">
          {isAllSuccess ? (
            <Check className="size-5 text-[var(--ui-success)] animate-in zoom-in" />
          ) : isPartialSuccess ? (
            <AlertCircle className="size-5 text-[var(--ui-warning)] animate-in zoom-in" />
          ) : isAllFailed ? (
            <X className="size-5 text-[var(--ui-danger)] animate-in zoom-in stroke-[2.5]" />
          ) : (
            <div className="flex flex-col items-center leading-none">
              <span className="font-mono font-extrabold text-[12px] text-[var(--ui-text)] tracking-tight">
                {processedCount}/{totalCount}
              </span>
              {isProcessing && (
                <Loader2 className="size-2.5 text-[var(--ui-accent)] animate-spin mt-0.5" />
              )}
            </div>
          )}
        </div>

        {}
        <span className="absolute -top-1 -right-1 size-4 rounded-full bg-[var(--ui-surface)] border border-[var(--ui-border)] flex items-center justify-center text-[9px] ui-muted shadow-sm">
          <ChevronUp
            className={`size-2.5 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>
    </aside>
  );
};
