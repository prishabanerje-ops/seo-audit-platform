import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Activity, Info, AlertTriangle,
  List, Map, Globe,
} from 'lucide-react';
import api                   from '../api/index.js';
import { useSites }          from '../context/SitesContext.jsx';
import { useToast }          from '../context/ToastContext.jsx';
import { Button }            from '../components/ui/Button.jsx';
import { Tabs }              from '../components/ui/Tabs.jsx';
import { CrawlConfigPanel, DEFAULT_CONFIG } from '../components/CrawlConfigPanel.jsx';

const TABS = [
  { value: 'spider',  label: 'Spider Crawl' },
  { value: 'list',    label: 'List Mode'    },
  { value: 'sitemap', label: 'Sitemap'      },
];

export function CrawlStart() {
  const navigate            = useNavigate();
  const { sites, activeSite, setActiveSite } = useSites();
  const { toast }           = useToast();
  const [mode,    setMode]    = useState('spider');
  const [siteId,  setSiteId]  = useState(activeSite?.id || '');
  const [config,  setConfig]  = useState({ ...DEFAULT_CONFIG });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // List mode state
  const [listText,      setListText]      = useState('');

  // Sitemap mode state
  const [sitemapSub,    setSitemapSub]    = useState('single'); // 'single' | 'multiple'
  const [sitemapUrl,    setSitemapUrl]    = useState('');
  const [sitemapText,   setSitemapText]   = useState('');

  const handleSiteChange = (id) => {
    setSiteId(id);
    const s = sites.find(s => s.id === id);
    if (s) setActiveSite(s);
  };

  // ── Submit helpers ────────────────────────────────────────────────────────

  const handleSpiderSubmit = async () => {
    if (!siteId) { setError('Please select a site.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/crawls', { site_id: siteId, mode: 'spider', config });
      toast.success('Crawl started');
      navigate(`/crawl/${res.data.id}/live`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start crawl');
    } finally {
      setLoading(false);
    }
  };

  const handleListSubmit = async () => {
    if (!siteId) { setError('Please select a site.'); return; }
    const list_urls = listText.split('\n').map(u => u.trim()).filter(Boolean);
    if (list_urls.length === 0) { setError('Enter at least one URL.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/crawls', {
        site_id: siteId,
        mode:    'list',
        config:  { ...config, list_urls },
      });
      toast.success('List crawl started');
      navigate(`/crawl/${res.data.id}/live`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start crawl');
    } finally {
      setLoading(false);
    }
  };

  const handleSitemapSubmit = async () => {
    if (!siteId) { setError('Please select a site.'); return; }
    // Validate before touching loading state
    if (sitemapSub === 'single' && !sitemapUrl.trim()) {
      setError('Enter a sitemap URL.'); return;
    }
    const sitemap_urls = sitemapSub === 'multiple'
      ? sitemapText.split('\n').map(u => u.trim()).filter(Boolean)
      : [];
    if (sitemapSub === 'multiple' && sitemap_urls.length === 0) {
      setError('Enter at least one sitemap URL.'); return;
    }

    setLoading(true); setError('');
    try {
      const body = sitemapSub === 'single'
        ? { site_id: siteId, mode: 'sitemap',      config: { ...config, sitemap_url: sitemapUrl.trim() } }
        : { site_id: siteId, mode: 'sitemap-list', config: { ...config, sitemap_urls } };
      const res = await api.post('/crawls', body);
      toast.success('Sitemap crawl started');
      navigate(`/crawl/${res.data.id}/live`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start crawl');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = {
    spider:  handleSpiderSubmit,
    list:    handleListSubmit,
    sitemap: handleSitemapSubmit,
  }[mode];

  const submitLabel = {
    spider:  'Start Crawl',
    list:    'Start List Crawl',
    sitemap: 'Start Sitemap Crawl',
  }[mode];

  const submitIcon = {
    spider:  <Activity className="w-4 h-4" />,
    list:    <List     className="w-4 h-4" />,
    sitemap: <Map      className="w-4 h-4" />,
  }[mode];

  const selectedSite = sites.find(s => s.id === siteId);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--brand-subtle)', color: 'var(--brand)' }}
        >
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Start Crawl</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Configure and launch a new SEO crawl
          </p>
        </div>
      </div>

      {/* Site selector */}
      <div
        className="rounded-xl p-5 mb-4"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          Site to crawl
        </label>
        {sites.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No sites registered.{' '}
            <button onClick={() => navigate('/sites/new')} className="underline" style={{ color: 'var(--brand)' }}>
              Add a site first
            </button>
          </p>
        ) : (
          <select
            value={siteId}
            onChange={e => handleSiteChange(e.target.value)}
            className="w-full h-9 px-3 rounded-md text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">Select a site…</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.label} — {s.url}</option>
            ))}
          </select>
        )}
        {selectedSite && (
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Root URL: <span style={{ color: 'var(--text-primary)' }}>{selectedSite.url}</span>
          </p>
        )}
      </div>

      {/* Mode tabs + content */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="px-5 pt-4">
          <Tabs tabs={TABS} activeTab={mode} onChange={(v) => { setMode(v); setError(''); }} />
        </div>

        <div className="p-5">
          {mode === 'spider'  && <CrawlConfigPanel config={config} onChange={setConfig} />}
          {mode === 'list'    && <ListModeForm    text={listText}    onChange={setListText} />}
          {mode === 'sitemap' && (
            <SitemapModeForm
              sub={sitemapSub}   onSubChange={setSitemapSub}
              url={sitemapUrl}   onUrlChange={setSitemapUrl}
              text={sitemapText} onTextChange={setSitemapText}
            />
          )}

          {error && (
            <div className="flex items-start gap-2 mt-4 p-3 rounded-md"
              style={{ backgroundColor: 'var(--severity-critical-bg)', border: '1px solid var(--severity-critical-border)' }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--severity-critical)' }} />
              <p className="text-sm" style={{ color: 'var(--severity-critical-text)' }}>{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-5">
            <Button variant="secondary" onClick={() => navigate('/crawl/status')}>
              View Jobs
            </Button>
            <Button
              loading={loading}
              disabled={!siteId}
              onClick={handleSubmit}
              iconLeft={submitIcon}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── List Mode form ────────────────────────────────────────────────────────────

function ListModeForm({ text, onChange }) {
  const urlCount = text.split('\n').map(u => u.trim()).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div
        className="flex items-start gap-2 p-3 rounded-md"
        style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}
      >
        <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>List mode</strong> audits a specific set
          of URLs without following links. Each URL is fetched directly and all checks are run —
          no crawling beyond the list.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            URLs to audit <span style={{ color: 'var(--text-muted)' }}>(one per line)</span>
          </label>
          {urlCount > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded font-mono"
              style={{ backgroundColor: 'var(--brand-subtle)', color: 'var(--brand)' }}
            >
              {urlCount.toLocaleString()} URL{urlCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <textarea
          rows={10}
          value={text}
          onChange={e => onChange(e.target.value)}
          placeholder={'https://example.com/page-1\nhttps://example.com/page-2\nhttps://example.com/page-3'}
          className="w-full px-3 py-2 rounded-md text-sm font-mono resize-y focus:outline-none"
          style={{
            backgroundColor: 'var(--bg-raised)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          }}
          onFocus={e  => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
          onBlur={e   => e.currentTarget.style.boxShadow = ''}
        />
      </div>
    </div>
  );
}

// ── Sitemap Mode form ─────────────────────────────────────────────────────────

function SitemapModeForm({ sub, onSubChange, url, onUrlChange, text, onTextChange }) {
  const sitemapCount = text.split('\n').map(u => u.trim()).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div
        className="flex items-start gap-2 p-3 rounded-md"
        style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}
      >
        <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Sitemap mode</strong> fetches URLs from
          one or more XML sitemaps and audits them — without crawling the site. Ideal for auditing
          only the URLs Google is told about.
        </p>
      </div>

      {/* Single / Multiple radio */}
      <div className="flex gap-3">
        {[
          { value: 'single',   label: 'Single sitemap'    },
          { value: 'multiple', label: 'Multiple sitemaps' },
        ].map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSubChange(opt.value)}
            className="flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: sub === opt.value ? 'var(--brand-subtle)' : 'var(--bg-raised)',
              color:           sub === opt.value ? 'var(--brand-text)'   : 'var(--text-muted)',
              border: sub === opt.value
                ? '1px solid var(--brand)'
                : '1px solid var(--border-default)',
            }}
          >
            {sub === opt.value
              ? <Globe className="w-3.5 h-3.5" />
              : <Globe className="w-3.5 h-3.5" style={{ opacity: 0.4 }} />
            }
            {opt.label}
          </button>
        ))}
      </div>

      {/* Single sitemap URL */}
      {sub === 'single' && (
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
            Sitemap URL
          </label>
          <input
            type="url"
            value={url}
            onChange={e => onUrlChange(e.target.value)}
            placeholder="https://example.com/sitemap.xml"
            className="w-full h-9 px-3 rounded-md text-sm font-mono focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
            onFocus={e  => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
            onBlur={e   => e.currentTarget.style.boxShadow = ''}
          />
        </div>
      )}

      {/* Multiple sitemap URLs */}
      {sub === 'multiple' && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Sitemap URLs <span style={{ color: 'var(--text-muted)' }}>(one per line)</span>
            </label>
            {sitemapCount > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded font-mono"
                style={{ backgroundColor: 'var(--brand-subtle)', color: 'var(--brand)' }}
              >
                {sitemapCount} sitemap{sitemapCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <textarea
            rows={6}
            value={text}
            onChange={e => onTextChange(e.target.value)}
            placeholder={'https://example.com/sitemap.xml\nhttps://example.com/sitemap-blog.xml\nhttps://example.com/sitemap-products.xml'}
            className="w-full px-3 py-2 rounded-md text-sm font-mono resize-y focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
            onFocus={e  => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
            onBlur={e   => e.currentTarget.style.boxShadow = ''}
          />
        </div>
      )}
    </div>
  );
}

