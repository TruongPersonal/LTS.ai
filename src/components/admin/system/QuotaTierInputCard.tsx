import React from 'react';
import { useTranslation } from 'react-i18next';

interface QuotaTierInputCardProps {
  title: string;
  badgeLabel: string;
  badgeClassName: string;
  cardClassName: string;
  titleClassName?: string;
  dailyMinutes: number;
  maxFileSizeMb: number;
  maxFileSizeLimit?: number;
  onDailyMinutesChange: (value: number) => void;
  onMaxFileSizeMbChange: (value: number) => void;
}

export const QuotaTierInputCard: React.FC<QuotaTierInputCardProps> = ({
  title,
  badgeLabel,
  badgeClassName,
  cardClassName,
  titleClassName = 'text-[var(--ui-text)]',
  dailyMinutes,
  maxFileSizeMb,
  maxFileSizeLimit = 2000,
  onDailyMinutesChange,
  onMaxFileSizeMbChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`ui-card-flat p-4 space-y-3.5 rounded-2xl ${cardClassName}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold ${titleClassName}`}>{title}</span>
        <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${badgeClassName}`}>
          {badgeLabel}
        </span>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold ui-muted">
          {t('admin.system.dailyMinutes')}
        </label>
        <div className="relative">
          <input
            type="number"
            min={0}
            max={1440}
            value={dailyMinutes}
            onChange={(e) => onDailyMinutesChange(Number(e.target.value))}
            className="ui-input pr-16 text-xs font-semibold"
            required
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] ui-muted pointer-events-none">
            min/day
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold ui-muted">
          {t('admin.system.maxFileSize')}
        </label>
        <div className="relative">
          <input
            type="number"
            min={1}
            max={maxFileSizeLimit}
            value={maxFileSizeMb}
            onChange={(e) => onMaxFileSizeMbChange(Number(e.target.value))}
            className="ui-input pr-14 text-xs font-semibold"
            required
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] ui-muted pointer-events-none">
            MB
          </span>
        </div>
      </div>
    </div>
  );
};
