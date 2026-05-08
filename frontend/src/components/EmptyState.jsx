import { Link } from 'react-router';
import { SearchX } from 'lucide-react';

export function EmptyState({ message = 'No data', description, action, icon: Icon = SearchX }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--bg-raised)' }}
      >
        <Icon className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{message}</p>
      {description && (
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
      {action && (
        (action.to || action.href) ? (
          <Link
            to={action.to || action.href}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--brand)', color: '#fff' }}
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--brand)', color: '#fff' }}
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
