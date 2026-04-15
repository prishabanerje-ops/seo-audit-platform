import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Superadmin company context ─────────────────────────────────────────────
  // Stored as { id, name } in localStorage so the name is available instantly.
  const [viewingCompany, setViewingCompanyState] = useState(() => {
    try {
      const saved = localStorage.getItem('viewingCompany');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setViewingCompany = (company) => {
    if (company) {
      localStorage.setItem('viewingCompany', JSON.stringify(company));
    } else {
      localStorage.removeItem('viewingCompany');
    }
    setViewingCompanyState(company);
  };

  // Clear viewing company if the logged-in user is not superadmin
  useEffect(() => {
    if (user && user.role !== 'superadmin') {
      setViewingCompany(null);
    }
  }, [user]);

  // Fetch current session on mount
  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setViewingCompany(null);
    setUser(null);
  }, []);

  // Convenience derived values
  const companyId        = user?.company_id ?? null;
  const viewingCompanyId = viewingCompany?.id ?? null;

  return (
    <AuthContext.Provider value={{
      user, setUser,
      companyId,
      isLoading,
      logout,
      viewingCompany,
      viewingCompanyId,
      setViewingCompany,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
