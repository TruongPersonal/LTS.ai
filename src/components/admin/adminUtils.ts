export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export const getActionBadgeClass = (action: string): string => {
  if (action.includes('DELETE') || action.includes('BAN')) {
    return 'bg-[var(--ui-danger-soft)] text-[var(--ui-danger)] border-[var(--ui-danger)]/30';
  }
  if (action.includes('UNBAN') || action.includes('RESET')) {
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
  }
  if (action.includes('SET_ROLE') || action.includes('CONFIG')) {
    return 'bg-[var(--ui-accent-soft)] text-[var(--ui-accent)] border-[var(--ui-accent)]/30';
  }
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
};
