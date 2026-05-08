import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-6xl font-bold mb-4" style={{ color: 'var(--border-strong)' }}>404</p>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Page not found</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/admin"
          className="inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--brand)' }}
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
