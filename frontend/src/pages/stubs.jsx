/**
 * Route stub pages — placeholder shells for all routes not yet built.
 * Each exports a named component. Replace one at a time with the real page.
 */

import { useState, useEffect } from 'react';
import api from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

function Stub({ title, description }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div
          className="w-12 h-12 rounded-xl mx-auto mb-4"
          style={{ backgroundColor: 'var(--bg-raised)' }}
        />
        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        {description && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
        )}
        <p className="text-xs mt-4" style={{ color: 'var(--border-strong)' }}>
          Coming in a later phase
        </p>
      </div>
    </div>
  );
}

export function AdminView()        { return <Stub title="Admin View"           description="Admin-level overview of platform health and activity." />; }
export function DeveloperView()    { return <Stub title="Developer View"       description="Developer-focused audit summary and technical checks." />; }
export function SeoView()          { return <Stub title="SEO Dashboard"        description="SEO analyst overview: scores, issues, recommendations." />; }


export function IssueDetail()      { return <Stub title="Issue Detail"        description="Deep-dive into a specific SEO issue." />; }
export function CoreWebVitals()    { return <Stub title="Core Web Vitals"     description="CWV scores from PageSpeed Insights and CrUX." />; }

export function Tasks()            { return <Stub title="Tasks"               description="SEO task board: backlog, in-progress, done." />; }
export function TaskDetail()       { return <Stub title="Task Detail"         description="Individual task with comments and Linear sync." />; }

export function ScheduledCrawls()  { return <Stub title="Scheduled Crawls"   description="Recurring crawl schedules and history." />; }
export function Exports()          { return <Stub title="Exports"            description="Download audit reports as CSV or PDF." />; }
export function Notifications()    { return <Stub title="Notifications"      description="Platform notifications and alert history." />; }

const ADS_PLATFORMS = [
  { id: 'google',   label: 'Google Ads',   color: '#4285F4' },
  { id: 'meta',     label: 'Meta Ads',     color: '#1877F2' },
  { id: 'linkedin', label: 'LinkedIn Ads', color: '#0A66C2' },
];

function PaidAdsSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('ads_connected');
    const adsError  = params.get('ads_error');
    if (connected || adsError) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    api.get('/ads/connections')
      .then(r => setConnections(r.data.connections || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const connectedPlatforms = new Set(connections.map(c => c.platform));

  async function handleConnect(platform) {
    setActionLoading(platform);
    try {
      const { data } = await api.post(`/ads/connect/${platform}`);
      window.location.href = data.authUrl;
    } catch {
      setActionLoading('');
    }
  }

  async function handleDisconnect(platform) {
    if (!window.confirm(`Disconnect ${platform}? This will remove stored tokens and cached metrics.`)) return;
    setActionLoading(platform);
    try {
      await api.delete(`/ads/connections/${platform}`);
      setConnections(prev => prev.filter(c => c.platform !== platform));
    } finally {
      setActionLoading('');
    }
  }

  if (loading) {
    return <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading ad connections…</div>;
  }

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Paid Ads
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
        {ADS_PLATFORMS.map(({ id, label, color }) => {
          const connected = connectedPlatforms.has(id);
          const busy = actionLoading === id;
          return (
            <div key={id} style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{label}</span>
                {connected && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '0.65rem',
                    background: 'var(--severity-pass)',
                    color: '#fff',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontWeight: 600,
                  }}>Connected</span>
                )}
              </div>

              {isAdmin && (
                connected ? (
                  <button
                    onClick={() => handleDisconnect(id)}
                    disabled={busy}
                    style={{
                      padding: '0.375rem 0.75rem',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: busy ? 'not-allowed' : 'pointer',
                      fontSize: '0.8rem',
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {busy ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(id)}
                    disabled={busy}
                    style={{
                      padding: '0.375rem 0.75rem',
                      borderRadius: 6,
                      border: 'none',
                      background: color,
                      color: '#fff',
                      cursor: busy ? 'not-allowed' : 'pointer',
                      fontSize: '0.8rem',
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {busy ? 'Connecting…' : 'Connect'}
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function Integrations() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 900 }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
        Integrations
      </h2>
      <PaidAdsSection />
    </div>
  );
}
export function SystemHealth()     { return <Stub title="System Health"      description="Backend service status and error log." />; }
export function Users()            { return <Stub title="Users"              description="Manage team members and pending invites." />; }
export function Settings()         { return <Stub title="Settings"           description="Platform-wide settings and configuration." />; }

export function GscOverlay()       { return <Stub title="GSC Overlay"        description="Google Search Console data overlay on audit results." />; }
export function Ga4Overlay()       { return <Stub title="GA4 Overlay"        description="Google Analytics 4 traffic data overlay." />; }
export function ErrorLog()         { return <Stub title="Error Log"          description="Frontend and backend error log." />; }
export function CompareView()      { return <Stub title="Compare Crawls"     description="Side-by-side comparison of two completed crawls." />; }

/* ── Audit category stubs (20 categories) ────────────────────────────────── */
export function AuditIndexability()   { return <Stub title="Indexability"    />; }
export function AuditTitleTags()      { return <Stub title="Title Tags"      />; }
export function AuditMetaDesc()       { return <Stub title="Meta Descriptions" />; }
export function AuditHeadings()       { return <Stub title="Headings"        />; }
export function AuditCanonicals()     { return <Stub title="Canonicals"      />; }
export function AuditHreflang()       { return <Stub title="Hreflang"        />; }
export function AuditImages()         { return <Stub title="Images"          />; }
export function AuditLinks()          { return <Stub title="Links"           />; }
export function AuditRedirects()      { return <Stub title="Redirects"       />; }
export function AuditResponseCodes()  { return <Stub title="Response Codes"  />; }
export function AuditPageSpeed()      { return <Stub title="Page Speed"      />; }
export function AuditStructuredData() { return <Stub title="Structured Data" />; }
export function AuditSecurity()       { return <Stub title="Security"        />; }
export function AuditMobile()         { return <Stub title="Mobile"          />; }
export function AuditCrawlDepth()     { return <Stub title="Crawl Depth"     />; }
export function AuditSitemap()        { return <Stub title="Sitemap"         />; }
export function AuditRobots()         { return <Stub title="Robots.txt"      />; }
export function AuditInternational()  { return <Stub title="International"   />; }
export function AuditContent()        { return <Stub title="Content"         />; }
export function AuditCustom()              { return <Stub title="Custom Checks"      />; }
export function AuditCustomExtraction()    { return <Stub title="Custom Extraction"  description="Extract custom data points from crawled pages." />; }
export function AuditLogFile()             { return <Stub title="Log File Intelligence" description="Analyse server log files to understand bot crawl behaviour." />; }
