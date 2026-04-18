import { Link, useLocation } from 'react-router';
import {
  LayoutDashboard, Code2, TrendingUp, Globe, Activity,
  Heart, FolderKanban, Gauge, FileCode2, FileText,
  List, FileOutput, Calendar, Bell, Plug,
  Stethoscope, Users, Settings, ChevronLeft, ChevronRight,
  Building2, ClipboardList, BarChart3, GitCompareArrows,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_SECTIONS = [
  {
    label: 'MAIN',
    items: [
      { label: 'Admin View',     icon: LayoutDashboard, path: '/admin',     roles: ['admin'] },
      { label: 'Developer View', icon: Code2,           path: '/developer'  },
      { label: 'SEO View',       icon: TrendingUp,      path: '/seo'        },
    ],
  },
  {
    label: 'PLATFORM',
    items: [
      { label: 'Sites',               icon: Globe,         path: '/sites'           },
      { label: 'Crawls',              icon: Activity,      path: '/crawl/status'            },
      { label: 'Paid Ads',            icon: BarChart3,     path: '/ads'                     },
      { label: 'Audit Health',        icon: Heart,         path: '/audit'                   },
      { label: 'Audit Categories',    icon: FolderKanban,  path: '/audit/categories',
        isActiveFn: (pathname) => {
          const excluded = ['/audit', '/audit/compare', '/audit/cwv',
                            '/audit/custom-extraction', '/audit/log-file',
                            '/audit/gsc', '/audit/ga4'];
          return pathname.startsWith('/audit/')
            && !excluded.some(p => pathname === p || pathname.startsWith(p + '/'));
        },
      },
      { label: 'Compare Crawls',      icon: GitCompareArrows, path: '/audit/compare'         },
      { label: 'Core Web Vitals',     icon: Gauge,         path: '/audit/cwv'               },
      { label: 'Custom Extraction',   icon: FileCode2,     path: '/audit/custom-extraction' },
      { label: 'Log File Intel.',     icon: FileText,      path: '/audit/log-file'          },
    ],
  },
  {
    label: 'WORKFLOW',
    items: [
      { label: 'Tasks',           icon: List,       path: '/tasks'      },
      { label: 'Reports/Exports', icon: FileOutput, path: '/exports'    },
      { label: 'Scheduled Crawls',icon: Calendar,   path: '/schedules'  },
      { label: 'Notifications',   icon: Bell,       path: '/notifications' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { label: 'Integrations',  icon: Plug,          path: '/integrations',  roles: ['admin'] },
      { label: 'System Health', icon: Stethoscope,   path: '/system',        roles: ['admin'] },
      { label: 'Users',         icon: Users,         path: '/users',         roles: ['admin'] },
      { label: 'Settings',      icon: Settings,      path: '/settings',      roles: ['admin'] },
    ],
  },
  {
    label: 'SUPERADMIN',
    items: [
      { label: 'Companies',  icon: Building2,    path: '/companies',  roles: ['superadmin'] },
      { label: 'Audit Log',  icon: ClipboardList, path: '/audit-log', roles: ['superadmin'] },
    ],
  },
];

export function Sidebar({ collapsed, onToggleCollapse }) {
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (item) =>
    item.isActiveFn
      ? item.isActiveFn(location.pathname)
      : (location.pathname === item.path || location.pathname.startsWith(item.path + '/'));

  const canSee = (item) => {
    if (!item.roles) return true;
    if (!user) return false;
    // Superadmin has unrestricted access — sees admin items AND superadmin-only items
    if (user.role === 'superadmin') return true;
    // Regular users: must match the item's allowed roles list
    return item.roles.includes(user.role);
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <aside
      className="h-screen sticky top-0 flex flex-col transition-all duration-200 shrink-0"
      style={{
        width: collapsed ? '56px' : '220px',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-default)',
      }}
    >
      {/* Logo */}
      <div
        className="h-14 flex items-center justify-center px-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border-default)' }}
      >
        {collapsed ? (
          <div className="w-6 h-6 rounded" style={{ backgroundColor: 'var(--brand)' }} />
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded" style={{ backgroundColor: 'var(--brand)' }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              SEO Audit
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(canSee);
          if (!visibleItems.length) return null;
          return (
            <div key={section.label} className="mb-5">
              {!collapsed && (
                <div
                  className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const Icon   = item.icon;
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className="flex items-center gap-2.5 h-9 px-3 rounded-md transition-colors relative text-sm"
                      style={{
                        backgroundColor: active ? 'var(--brand-subtle)' : 'transparent',
                        color: active ? 'var(--brand-text)' : 'var(--text-muted)',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-raised)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }
                      }}
                    >
                      {active && (
                        <span
                          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r"
                          style={{ backgroundColor: 'var(--brand)' }}
                        />
                      )}
                      <Icon className={`w-[18px] h-[18px] shrink-0 ${collapsed ? 'mx-auto' : ''}`} />
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer: user + collapse toggle */}
      <div
        className="shrink-0 p-2"
        style={{ borderTop: '1px solid var(--border-default)' }}
      >
        <div
          className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer"
          style={{ color: 'var(--text-primary)' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
            style={{ backgroundColor: 'var(--brand)' }}
          >
            {initials}
          </div>
          {!collapsed && (
            <span className="text-sm truncate flex-1" style={{ color: 'var(--text-primary)' }}>
              {user?.name || 'User'}
            </span>
          )}
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="w-full mt-1 flex items-center justify-center h-7 rounded-md transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : <ChevronLeft  className="w-4 h-4" />}
          </button>
        )}
      </div>
    </aside>
  );
}
