import type { Status } from '../data/mockData';

interface Props {
  status: Status;
}

const CONFIG: Record<Status, { label: string; bg: string; text: string; dot: string }> = {
  active: {
    label: 'Active',
    bg:   'var(--status-active-bg)',
    text: 'var(--status-active-text)',
    dot:  '#10b981',
  },
  paused: {
    label: 'Paused',
    bg:   'var(--status-paused-bg)',
    text: 'var(--status-paused-text)',
    dot:  '#f59e0b',
  },
  draft: {
    label: 'Draft',
    bg:   'var(--status-draft-bg)',
    text: 'var(--status-draft-text)',
    dot:  '#64748b',
  },
  ended: {
    label: 'Ended',
    bg:   'var(--status-ended-bg)',
    text: 'var(--status-ended-text)',
    dot:  '#ef4444',
  },
};

export default function StatusBadge({ status }: Props) {
  const c = CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 rounded text-xs font-medium tracking-wide uppercase whitespace-nowrap"
      style={{
        height:          22,
        backgroundColor: c.bg,
        color:           c.text,
      }}
    >
      <span
        className="rounded-full flex-shrink-0"
        style={{ width: 6, height: 6, backgroundColor: c.dot }}
      />
      {c.label}
    </span>
  );
}
