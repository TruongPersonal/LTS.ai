import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  actionVariant?: 'primary' | 'secondary';
  role?: string;
  iconClassName?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  actionVariant = 'primary',
  role,
  iconClassName = 'size-8 ui-soft',
}) => {
  return (
    <div className="workspace-empty-state" role={role}>
      <Icon className={iconClassName} />
      <h2 className="text-base font-bold">{title}</h2>
      {description && <p className="text-xs ui-muted max-w-sm mt-1">{description}</p>}
      {actionText && onAction && (
        <button
          onClick={onAction}
          className={`ui-button ui-button-${actionVariant} mt-3`}
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
