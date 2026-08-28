import React from 'react';
import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModalWrapper } from '../common/ModalWrapper';
import type { AdminAuditLog } from '../../services/adminService';
import { formatDateTime, getActionBadgeClass } from './adminUtils';

interface AuditLogDetailModalProps {
  isOpen: boolean;
  log: AdminAuditLog | null;
  onClose: () => void;
}

export const AuditLogDetailModal: React.FC<AuditLogDetailModalProps> = ({
  isOpen,
  log,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!log) return null;

  const actorEmail = String((log.new_value as Record<string, unknown> | null)?.actor_email || log.actor_user_id || '—');
  
  // Clean new_value to remove duplicate actor_email
  const cleanedNewValue = { ...((log.new_value as Record<string, unknown> | null) || {}) };
  delete cleanedNewValue.actor_email;
  
  const hasOldValue = Boolean(log.old_value && Object.keys(log.old_value as object).length > 0);
  const hasNewValue = Boolean(Object.keys(cleanedNewValue).length > 0);

  const getTargetName = () => {
    const details = ((log.new_value || log.old_value || {}) as Record<string, unknown>);
    if (details.target_email) return String(details.target_email);
    if (details.project_title) return `Dự án: ${details.project_title}`;
    if (details.file_name) return `Tệp: ${details.file_name}`;
    if (log.target_user_id) return `User ID: ${log.target_user_id.slice(0, 8)}...`;
    return t('admin.logs.systemTarget', 'Toàn hệ thống');
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={t('admin.logs.detailsModalTitle', 'Chi tiết Nhật ký Hoạt động')}
      subtitle={formatDateTime(log.created_at)}
      icon={<Activity className="size-5 text-[var(--ui-accent)]" />}
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Meta summary strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-[var(--ui-surface-subtle)] rounded-xl border border-[var(--ui-border)] text-xs">
          <div>
            <div className="ui-muted mb-1">{t('admin.logs.action', 'Hành động')}</div>
            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border font-mono ${getActionBadgeClass(log.action)}`}>
              {log.action}
            </span>
          </div>
          <div>
            <div className="ui-muted mb-1">{t('admin.logs.actor', 'Thực hiện bởi')}</div>
            <div className="font-semibold font-mono text-[var(--ui-text)] truncate">{actorEmail}</div>
          </div>
          <div>
            <div className="ui-muted mb-1">{t('admin.logs.target', 'Ảnh hưởng đến')}</div>
            <div className="font-semibold text-[var(--ui-text)] truncate">{getTargetName()}</div>
          </div>
        </div>

        {/* Diff Comparison Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Old Value */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ui-danger)]">
              <div className="size-2 rounded-full bg-[var(--ui-danger)]" />
              <span>{t('admin.logs.oldValue', 'Giá trị trước đó')}</span>
            </div>
            <div className="flex-1 bg-[var(--ui-surface-subtle)] border border-[var(--ui-border)] rounded-xl p-3 min-h-[140px] max-h-[300px] overflow-auto">
              {hasOldValue ? (
                <pre className="font-mono text-[11px] text-[var(--ui-text)] whitespace-pre-wrap break-all leading-relaxed">
                  {JSON.stringify(log.old_value, null, 2)}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-xs ui-muted italic text-center p-4">
                  {t('admin.logs.noOldValue', 'Không có dữ liệu trước đó')}
                </div>
              )}
            </div>
          </div>

          {/* New Value */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <div className="size-2 rounded-full bg-emerald-400" />
              <span>{t('admin.logs.newValue', 'Giá trị mới')}</span>
            </div>
            <div className="flex-1 bg-[var(--ui-surface-subtle)] border border-[var(--ui-border)] rounded-xl p-3 min-h-[140px] max-h-[300px] overflow-auto">
              {hasNewValue ? (
                <pre className="font-mono text-[11px] text-emerald-400 whitespace-pre-wrap break-all leading-relaxed">
                  {JSON.stringify(cleanedNewValue, null, 2)}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-xs ui-muted italic text-center p-4">
                  {t('admin.logs.noNewValue', 'Dữ liệu đã bị xóa khỏi hệ thống')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end pt-3 border-t border-[var(--ui-border)]">
          <button
            type="button"
            onClick={onClose}
            className="ui-button ui-button-secondary text-xs"
          >
            {t('admin.actions.close', 'Đóng')}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};
