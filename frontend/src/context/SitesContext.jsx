import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/index.js';
import { useAuth } from './AuthContext.jsx';

const SitesContext = createContext(null);

export function SitesProvider({ children }) {
  const { user, viewingCompanyId } = useAuth();
  const [sites,      setSites]      = useState([]);
  const [activeSite, setActiveSite] = useState(null);
  const [loading,    setLoading]    = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Superadmin scopes to the company they are currently viewing
      const url = user.role === 'superadmin' && viewingCompanyId
        ? `/sites?company_id=${viewingCompanyId}`
        : '/sites';
      const res = await api.get(url);
      setSites(res.data.data || []);
    } catch {
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, [user, viewingCompanyId]);

  useEffect(() => { reload(); }, [reload]);

  // Persist active site in sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('activeSiteId');
    if (saved && sites.length) {
      const match = sites.find(s => s.id === saved);
      if (match) { setActiveSite(match); return; }
    }
    if (sites.length && !activeSite) setActiveSite(sites[0]);
  }, [sites]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetActiveSite = (site) => {
    setActiveSite(site);
    if (site) sessionStorage.setItem('activeSiteId', site.id);
    else sessionStorage.removeItem('activeSiteId');
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createSite = async (data) => {
    const body = (user.role === 'superadmin' && viewingCompanyId)
      ? { ...data, company_id: viewingCompanyId }
      : data;
    const res = await api.post('/sites', body);
    await reload();
    handleSetActiveSite(res.data);
    return res.data;
  };

  const updateSite = async (id, data) => {
    const res = await api.patch(`/sites/${id}`, data);
    await reload();
    // Keep activeSite in sync
    if (activeSite?.id === id) handleSetActiveSite(res.data);
    return res.data;
  };

  const deleteSite = async (id) => {
    await api.delete(`/sites/${id}`);
    if (activeSite?.id === id) handleSetActiveSite(null);
    await reload();
  };

  return (
    <SitesContext.Provider value={{
      sites,
      activeSite,
      setActiveSite: handleSetActiveSite,
      loading,
      reload,
      createSite,
      updateSite,
      deleteSite,
    }}>
      {children}
    </SitesContext.Provider>
  );
}

export function useSites() {
  const ctx = useContext(SitesContext);
  if (!ctx) throw new Error('useSites must be used within SitesProvider');
  return ctx;
}
