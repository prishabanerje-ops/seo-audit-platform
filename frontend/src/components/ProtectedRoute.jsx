import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Redirects to /login if no session.
 * Shows a blank screen while auth is loading (prevents flash).
 */
export function ProtectedRoute({ children, role }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // superadmin passes all role guards
  if (role && user.role !== role && user.role !== 'superadmin') {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

/**
 * Convenience wrapper: requires a specific role.
 */
export function RequireRole({ role, children }) {
  return <ProtectedRoute role={role}>{children}</ProtectedRoute>;
}
