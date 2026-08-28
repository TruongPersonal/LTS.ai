import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import type { FileStatus } from '../../types/database';

export type DisplayFileStatus = FileStatus | 'queued';

interface FileStatusBadgeProps {
  status: DisplayFileStatus;
}

export const FileStatusBadge: React.FC<FileStatusBadgeProps> = ({ status }) => {
  const { t } = useTranslation();

  const getBadgeConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: <CheckCircle2 className="size-3" />,
          label: t('media.status.completed'),
          className: 'ui-badge-success',
        };
      case 'failed':
        return {
          icon: <XCircle className="size-3" />,
          label: t('media.status.failed'),
          className: 'ui-badge-danger',
        };
      case 'processing':
        return {
          icon: <Loader2 className="size-3 animate-spin" />,
          label: t('media.status.processing'),
          className: 'ui-badge-accent',
        };
      case 'queued':
        return {
          icon: <Clock className="size-3" />,
          label: t('media.status.queued'),
          className: 'ui-badge-warning',
        };
      case 'draft':
      default:
        return {
          icon: <Clock className="size-3" />,
          label: t('media.status.draft'),
          className: 'ui-badge-neutral',
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.className}`}>
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};
