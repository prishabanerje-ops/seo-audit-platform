/**
 * Route stub pages — placeholder shells for all routes not yet built.
 * Each exports a named component. Replace one at a time with the real page.
 */

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

export function SystemHealth()          { return <Stub title="System Health"           description="Backend service status and diagnostics." />; }
export function ErrorLog()              { return <Stub title="Error Log"               description="Frontend and backend error log viewer." />; }
export function AuditCustomExtraction() { return <Stub title="Custom Extraction"       description="Extract custom data points from crawled pages." />; }
export function AuditLogFile()          { return <Stub title="Log File Intelligence"   description="Analyse server logs for crawl budget insights." />; }
