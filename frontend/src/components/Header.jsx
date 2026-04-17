import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, Bell, Sun, Moon, ChevronDown, LogOut, Plus, Building2, X, Loader2 } from 'lucide-react';
import { useSites } from '../context/SitesContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api from '../api/index.js';

// ─── Impersonation Banner ─────────────────────────────────────────────────────

function ImpersonationBanner() {
  const { user, endImpersonation } = useAuth();
  const navigate = useNavigate();
  const [ending, setEnding] = useState(false);

  const handleEnd = async () => {
    setEnding(true);
    try {
      await endImpersonation();
      navigate('/companies');
    } finally {
      setEnding(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-1.5 text-xs font-medium shrink-0"
      style={{ backgroundColor: 'var(--severity-warning)', color: '#000' }}
    >
      <span>
        Impersonating <strong>{user?.name}</strong> ({user?.email})
      </span>
      <button
        onClick={handleEnd}
        disabled={ending}
        className="flex items-center gap-1 px-2 py-0.5 rounded font-semibold"
        style={{ backgroundColor: 'rgba(0,0,0,0.15)', color: '#000', opacity: ending ? 0.6 : 1 }}
      >
        {ending && <Loader2 className="w-3 h-3 animate-spin" />}
        End Session
      </button>
    </div>
  );
}

function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'dark'
  );
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };
  return { theme, toggle };
}

// ─── Company Switcher (superadmin only) ───────────────────────────────────────

function CompanySwitcher() {
  const { viewingCompany, setViewingCompany } = useAuth();
  const { reload: reloadSites } = useSites();
  const [open,      setOpen]      = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loaded,    setLoaded]    = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Lazy-load company list when dropdown opens
  useEffect(() => {
    if (open && !loaded) {
      api.get('/companies')
        .then(r => { setCompanies(r.data.companies || []); setLoaded(true); })
        .catch(() => {});
    }
  }, [open, loaded]);

  const select = (company) => {
    setViewingCompany(company ? { id: company.id, name: company.name } : null);
    reloadSites();
    setOpen(false);
  };

  const label = viewingCompany ? viewingCompany.name : 'All Companies';

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors"
        style={{
          backgroundColor: viewingCompany ? 'var(--brand-subtle)' : 'var(--bg-raised)',
          border: `1px solid ${viewingCompany ? 'var(--brand)' : 'var(--border-default)'}`,
          color: viewingCompany ? 'var(--brand-text)' : 'var(--text-muted)',
        }}
        title="Switch company context"
      >
        <Building2 className="w-3.5 h-3.5 shrink-0" />
        <span className="max-w-[120px] truncate">Viewing: {label}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {viewingCompany && (
        <button
          onClick={e => { e.stopPropagation(); select(null); }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--brand)', color: '#fff' }}
          title="Clear company filter"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-56 rounded-md shadow-lg overflow-hidden z-50"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          {/* All Companies option */}
          <button
            onClick={() => select(null)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
            style={{
              backgroundColor: !viewingCompany ? 'var(--bg-raised)' : 'transparent',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = !viewingCompany ? 'var(--bg-raised)' : 'transparent'}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            All Companies
          </button>
          <div style={{ borderTop: '1px solid var(--border-default)' }} />
          {companies.map(c => (
            <button
              key={c.id}
              onClick={() => select(c)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
              style={{
                backgroundColor: viewingCompany?.id === c.id ? 'var(--bg-raised)' : 'transparent',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = viewingCompany?.id === c.id ? 'var(--bg-raised)' : 'transparent'}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: c.is_paid ? 'var(--severity-pass)' : 'var(--severity-critical-text)' }}
              />
              <span className="flex-1 truncate">{c.name}</span>
            </button>
          ))}
          {!loaded && companies.length === 0 && (
            <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header() {
  const { sites, activeSite, setActiveSite } = useSites();
  const { user, logout, isImpersonating } = useAuth();
  const { toast }          = useToast();
  const navigate           = useNavigate();
  const { theme, toggle }  = useTheme();

  const [siteOpen,    setSiteOpen]    = useState(false);
  const [userOpen,    setUserOpen]    = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const siteRef = useRef(null);
  const userRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e) {
      if (siteRef.current && !siteRef.current.contains(e.target)) setSiteOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Fetch unread notification count on mount
  useEffect(() => {
    api.get('/notifications', { params: { unread: true } })
      .then(({ data }) => setUnreadCount(data.unread_count ?? 0))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Signed out');
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <>
      {isImpersonating && <ImpersonationBanner />}
      <header
        className="h-14 flex items-center px-4 gap-3 shrink-0 sticky top-0 z-10"
        style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)' }}
      >
      {/* Site selector */}
      <div className="w-52 relative shrink-0" ref={siteRef}>
        <button
          onClick={() => setSiteOpen(o => !o)}
          className="w-full flex items-center gap-2 h-9 px-3 rounded-md text-sm transition-colors"
          style={{
            backgroundColor: 'var(--bg-raised)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          }}
        >
          {activeSite
            ? <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeSite.color || 'var(--brand)' }} />
            : <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'var(--text-muted)' }} />
          }
          <span className="flex-1 text-left truncate">{activeSite?.label || 'All Sites'}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${siteOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-muted)' }} />
        </button>

        {siteOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-1 rounded-md shadow-lg overflow-hidden z-50"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            {sites.length === 0 && (
              <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                No sites yet
              </div>
            )}
            {sites.map(site => (
              <button
                key={site.id}
                onClick={() => { setActiveSite(site); setSiteOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                style={{
                  backgroundColor: activeSite?.id === site.id ? 'var(--bg-raised)' : 'transparent',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor =
                  activeSite?.id === site.id ? 'var(--bg-raised)' : 'transparent'}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: site.color || 'var(--brand)' }} />
                <span className="flex-1 truncate">{site.label}</span>
              </button>
            ))}
            <div style={{ borderTop: '1px solid var(--border-default)' }}>
              <button
                onClick={() => { navigate('/sites/new'); setSiteOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
                style={{ color: 'var(--brand)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Plus className="w-4 h-4" />
                Add site
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Company switcher — superadmin only */}
      {user?.role === 'superadmin' && <CompanySwitcher />}

      {/* Search */}
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search pages, issues…"
            className="w-full h-9 pl-9 pr-3 rounded-md text-sm placeholder:text-[var(--text-muted)] focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
            onBlur={e =>  e.currentTarget.style.boxShadow = ''}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 ml-auto">
        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className="w-9 h-9 flex items-center justify-center rounded-md transition-colors relative"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-raised)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--severity-critical)' }}
              aria-label={`${unreadCount} unread notifications`}
            />
          )}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-9 h-9 flex items-center justify-center rounded-md transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-raised)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserOpen(o => !o)}
            className="flex items-center gap-2 h-9 px-2 rounded-md transition-colors"
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              {initials}
            </div>
          </button>

          {userOpen && (
            <div
              className="absolute top-full right-0 mt-1 w-52 rounded-md shadow-lg overflow-hidden z-50"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
            >
              <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                {user?.role === 'superadmin' && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                    style={{ backgroundColor: 'var(--brand-subtle)', color: 'var(--brand-text)' }}>
                    Superadmin
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      </header>
    </>
  );
}
