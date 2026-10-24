import { Inbox } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'Try adjusting your search criteria or add a new entry.',
  actionLabel,
  onAction,
}) {
  return (
    <div className="empty-state-box">
      <div className="empty-icon-circle">
        <Icon size={26} />
      </div>
      <div className="empty-title">{title}</div>
      <div className="empty-description">{description}</div>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary btn-sm" onClick={onAction} style={{ marginTop: 8 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
