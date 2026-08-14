import React from 'react';
import type { ProcessingProgress } from '../../types/processing';

interface FileProgressBarProps {
  progress?: ProcessingProgress;
}

export const FileProgressBar: React.FC<FileProgressBarProps> = ({ progress }) => {
  if (!progress || progress.stage === 'completed' || progress.stage === 'failed') {
    return null;
  }

  const percent = Math.min(100, Math.max(0, Math.round(progress.percent)));

  return (
    <div
      className="w-full mt-2 space-y-1"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="flex items-center justify-end text-[10px] font-mono text-[var(--ui-accent)] font-bold">
        <span>{percent}%</span>
      </div>
      <div className="w-full h-1.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-full overflow-hidden p-[1px]">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_var(--ui-accent-glow)]"
          style={{
            background: 'var(--cosmic-gradient)',
            width: `${percent}%`,
          }}
        />
      </div>
    </div>
  );
};
