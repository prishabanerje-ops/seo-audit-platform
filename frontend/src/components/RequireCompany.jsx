import { Outlet, Link } from 'react-router';
import { Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

function NoCompanySelected() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <Building2
          className="w-10 h-10 mx-auto mb-4"
          style={{ color: 'var(--text-muted)' }}
        />
        <h2
          className="text-base font-semibold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          No company selected
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Select a company from the header to continue.
        </p>
        <Link
          to="/companies"
          className="inline-flex items-center h-8 px-4 rounded-md text-xs font-semibold text-white"
          style={{ backgroundColor: 'var(--brand)' }}
        >
          Go to Companies
        </Link>
      </div>
    </div>
  );
}

/**
 * Route-level guard for company-scoped pages.
 * - Non-superadmin: always passes through (company_id is in their JWT).
 * - Superadmin + company selected: passes through.
 * - Superadmin + no company selected: shows NoCompanySelected prompt.
 */
export function RequireCompany() {
  const { user, viewingCompanyId } = useAuth();
  if (user?.role !== 'superadmin') return <Outlet />;
  if (viewingCompanyId) return <Outlet />;
  return <NoCompanySelected />;
}
