import { createBrowserRouter, Outlet } from 'react-router';

import { ProtectedRoute, RequireRole } from './components/ProtectedRoute.jsx';
import { RequireCompany } from './components/RequireCompany.jsx';
import { AppShell } from './components/AppShell.jsx';
import { HomePage }     from './pages/HomePage.jsx';
import { Login }        from './pages/Login.jsx';
import { Setup }        from './pages/Setup.jsx';
import { InviteAccept } from './pages/InviteAccept.jsx';
import { NotFound }     from './pages/NotFound.jsx';
import { AccessExpired }   from './pages/AccessExpired.jsx';
import { ChangePassword }  from './pages/ChangePassword.jsx';

import { Sites }         from './pages/Sites.jsx';
import { NewSiteWizard } from './pages/NewSiteWizard.jsx';
import { CrawlStart }    from './pages/CrawlStart.jsx';
import { CrawlStatus }   from './pages/CrawlStatus.jsx';
import { LiveRun }       from './pages/LiveRun.jsx';
import { AuditHealth }   from './pages/AuditHealth.jsx';
import { AdsDashboard }  from './pages/AdsDashboard.jsx';
import { Companies }     from './pages/Companies.jsx';
import { AuditLog }      from './pages/AuditLog.jsx';
import { Settings }      from './pages/Settings.jsx';
import { Users }         from './pages/Users.jsx';

import {
  AdminView, DeveloperView, SeoView,
  CoreWebVitals,
  Tasks, TaskDetail,
  ScheduledCrawls, Exports, Notifications,
  Integrations, SystemHealth,
  GscOverlay, Ga4Overlay, ErrorLog, CompareView,
  AuditCustomExtraction, AuditLogFile,
} from './pages/stubs.jsx';

import { AuditCategory } from './pages/AuditCategory.jsx';
import { IssueDetail }   from './pages/IssueDetail.jsx';

/* Authenticated shell wrapper */
function AuthedShell() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  );
}


/* Admin-only wrapper */
function AdminOnly() {
  return (
    <RequireRole role="admin">
      <Outlet />
    </RequireRole>
  );
}

/* Superadmin-only wrapper */
function SuperAdminOnly() {
  return (
    <RequireRole role="superadmin">
      <Outlet />
    </RequireRole>
  );
}

export const router = createBrowserRouter([
  /* ── Public ───────────────────────────────────────────────────────────── */
  { path: '/',                element: <HomePage /> },
  { path: '/login',           element: <Login /> },
  { path: '/setup',           element: <Setup /> },
  { path: '/invite/accept',   element: <InviteAccept /> },
  { path: '/access-expired',  element: <AccessExpired /> },
  { path: '/change-password', element: <ChangePassword /> },

  /* ── Authenticated ─────────────────────────────────────────────────────── */
  {
    element: <AuthedShell />,
    children: [
      /* Dashboards */
      { path: '/admin',       element: <AdminView /> },
      { path: '/developer',   element: <DeveloperView /> },
      { path: '/seo',         element: <SeoView /> },

      /* Notifications */
      { path: '/notifications',    element: <Notifications /> },

      /* Company-scoped routes */
      {
        element: <RequireCompany />,
        children: [
          /* Sites */
          { path: '/sites',          element: <Sites /> },
          { path: '/sites/new',      element: <NewSiteWizard /> },

          /* Crawls */
          { path: '/crawl',          element: <CrawlStart /> },
          { path: '/crawl/status',   element: <CrawlStatus /> },
          { path: '/crawl/:jobId/live', element: <LiveRun /> },

          /* Audit */
          { path: '/audit',                element: <AuditHealth /> },
          { path: '/audit/issue/:resultId', element: <IssueDetail /> },
          { path: '/audit/cwv',            element: <CoreWebVitals /> },
          { path: '/audit/compare',        element: <CompareView /> },
          { path: '/audit/gsc',            element: <GscOverlay /> },
          { path: '/audit/ga4',            element: <Ga4Overlay /> },

          /* Audit categories */
          { path: '/audit/indexability',        element: <AuditCategory /> },
          { path: '/audit/title-tags',          element: <AuditCategory /> },
          { path: '/audit/meta-desc',           element: <AuditCategory /> },
          { path: '/audit/headings',            element: <AuditCategory /> },
          { path: '/audit/canonicals',          element: <AuditCategory /> },
          { path: '/audit/hreflang',            element: <AuditCategory /> },
          { path: '/audit/images',              element: <AuditCategory /> },
          { path: '/audit/links',               element: <AuditCategory /> },
          { path: '/audit/redirects',           element: <AuditCategory /> },
          { path: '/audit/response-codes',      element: <AuditCategory /> },
          { path: '/audit/page-speed',          element: <AuditCategory /> },
          { path: '/audit/structured-data',     element: <AuditCategory /> },
          { path: '/audit/security',            element: <AuditCategory /> },
          { path: '/audit/mobile',              element: <AuditCategory /> },
          { path: '/audit/crawl-depth',         element: <AuditCategory /> },
          { path: '/audit/sitemap',             element: <AuditCategory /> },
          { path: '/audit/robots',              element: <AuditCategory /> },
          { path: '/audit/international',       element: <AuditCategory /> },
          { path: '/audit/content',             element: <AuditCategory /> },
          { path: '/audit/custom',              element: <AuditCategory /> },
          { path: '/audit/custom-extraction',   element: <AuditCustomExtraction /> },
          { path: '/audit/log-file',            element: <AuditLogFile /> },

          /* Paid Ads */
          { path: '/ads', element: <AdsDashboard /> },

          /* Tasks */
          { path: '/tasks',            element: <Tasks /> },
          { path: '/tasks/:id',        element: <TaskDetail /> },

          /* Platform */
          { path: '/schedules',        element: <ScheduledCrawls /> },
          { path: '/exports',          element: <Exports /> },

          /* System — admin-only group */
          {
            element: <AdminOnly />,
            children: [
              { path: '/integrations', element: <Integrations /> },
              { path: '/system',       element: <SystemHealth /> },
              { path: '/users',        element: <Users /> },
              { path: '/settings',     element: <Settings /> },
              { path: '/errors',       element: <ErrorLog /> },
            ],
          },
        ],
      },

      /* Superadmin-only group */
      {
        element: <SuperAdminOnly />,
        children: [
          { path: '/companies',  element: <Companies /> },
          { path: '/audit-log',  element: <AuditLog /> },
        ],
      },
    ],
  },

  /* Catch-all */
  { path: '*', element: <NotFound /> },
]);
