/**
 * CrawlConfigPanel — reusable crawl configuration panel.
 * Used in NewSiteWizard (Step 3) and CrawlStart page.
 *
 * Props:
 *   config   — current config object
 *   onChange — (fullConfig) => void  (receives the FULL new config, not a patch)
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';

// ── User-agent presets ────────────────────────────────────────────────────────
const UA_PRESETS = [
  {
    label: 'SEOAuditBot (default)',
    value: '',
    description: 'Our own bot identity — transparent, honest',
  },
  {
    label: 'Screaming Frog',
    value: 'Mozilla/5.0 (compatible; Screaming Frog SEO Spider/20.0; +https://www.screamingfrog.co.uk/seo-spider/)',
    description: 'Widely whitelisted by enterprise sites & Cloudflare rules',
  },
  {
    label: 'Googlebot',
    value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    description: 'Sites rarely block Googlebot — good for seeing bot-optimised content',
  },
  {
    label: 'Chrome (Desktop)',
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    description: 'Mimics a real Chrome browser on macOS',
  },
  {
    label: 'Chrome (Mobile)',
    value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
    description: 'Test how the site responds to mobile crawlers',
  },
  {
    label: 'Custom…',
    value: '__custom__',
    description: 'Enter your own user agent string',
  },
];

function UserAgentSelector({ value, onChange }) {
  // Determine if current value matches a preset
  const matchedPreset = UA_PRESETS.find(p => p.value === value && p.value !== '__custom__');
  const isCustom = !matchedPreset && value !== '';
  const selectValue = isCustom ? '__custom__' : (value ?? '');

  const preset = UA_PRESETS.find(p => p.value === selectValue) || UA_PRESETS[0];

  return (
    <div className="space-y-2 w-72">
      <select
        value={selectValue}
        onChange={e => {
          const v = e.target.value;
          if (v !== '__custom__') onChange(v);
          else onChange(value === '' ? '' : value); // keep existing custom value
        }}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{
          backgroundColor: 'var(--bg-raised)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
        }}
      >
        {UA_PRESETS.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>

      {/* Description for selected preset */}
      {preset && preset.value !== '__custom__' && (
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {preset.description}
        </p>
      )}

      {/* Custom input — shown when "Custom…" is selected or value doesn't match any preset */}
      {(selectValue === '__custom__' || isCustom) && (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Paste your user agent string…"
          className="w-full px-3 py-2 rounded-lg text-xs font-mono"
          style={{
            backgroundColor: 'var(--bg-raised)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          }}
        />
      )}
    </div>
  );
}

// Left-sidebar tab definitions
const TABS = [
  { id: 'spider',  label: 'Spider'          },
  { id: 'robots',  label: 'Robots & URLs'   },
  { id: 'speed',   label: 'Speed & Headers' },
  { id: 'custom',  label: 'Custom'          },
  { id: 'apis',    label: 'APIs'            },
];

export const DEFAULT_CONFIG = {
  // ── Limits ────────────────────────────────────────────────────────────────
  max_depth:            5,
  max_urls:             0,       // 0 = unlimited

  // ── Spider — what to follow ───────────────────────────────────────────────
  follow_internal:      true,
  follow_external:      false,
  crawl_images:         true,
  crawl_css:            true,
  crawl_javascript:     false,
  crawl_pdfs:           true,
  crawl_hreflang:       true,
  crawl_canonicals:     true,

  // ── User agent ────────────────────────────────────────────────────────────
  user_agent:           '',      // empty = use crawler default

  // ── URL filters ───────────────────────────────────────────────────────────
  include_patterns:     [],
  exclude_patterns:     [],

  // ── Concurrency ───────────────────────────────────────────────────────────
  threads:              5,       // max concurrent requests

  // ── Custom headers ────────────────────────────────────────────────────────
  custom_headers:       [],      // [{name, value}]

  // ── Auth ──────────────────────────────────────────────────────────────────
  basic_auth_user:      '',
  basic_auth_pass:      '',

  // ── Robots & directives ───────────────────────────────────────────────────
  respect_robots_txt:   true,
  obey_noindex:         true,
  obey_nofollow:        true,

  // ── URL rewriting / param stripping ──────────────────────────────────────
  strip_params:         false,
  strip_params_list:    [],      // param names, one per line

  // ── Custom extraction ─────────────────────────────────────────────────────
  custom_extractions:   [],      // [{label, selector, extract:'text'|'html'|'attribute', attribute:''}]
};

// ── Shared primitive components ───────────────────────────────────────────────

function FieldRow({ label, description, children, last = false }) {
  return (
    <div
      className="flex items-start justify-between gap-4 py-3"
      style={{ borderBottom: last ? 'none' : '1px solid var(--border-subtle)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {description && (
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{description}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <div className="pt-5 pb-1.5 mb-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}>
        {children}
      </p>
      <div className="mt-1.5" style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-9 h-5 rounded-full transition-colors relative shrink-0"
      style={{ backgroundColor: checked ? 'var(--brand)' : 'var(--border-strong)' }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm"
        style={{ left: checked ? '18px' : '2px' }}
      />
    </button>
  );
}

function NumberInput({ value, onChange, min = 0, max, step = 1, width = 'w-24' }) {
  return (
    <input
      type="number" min={min} max={max} step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className={`${width} h-8 px-2 rounded text-sm text-right focus:outline-none`}
      style={{
        backgroundColor: 'var(--bg-raised)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-primary)',
      }}
      onFocus={e  => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
      onBlur={e   => e.currentTarget.style.boxShadow = ''}
    />
  );
}

function TextInput({ value, onChange, placeholder = '', width = 'w-52', type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${width} h-8 px-2 rounded text-sm focus:outline-none`}
      style={{
        backgroundColor: 'var(--bg-raised)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-primary)',
      }}
      onFocus={e  => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
      onBlur={e   => e.currentTarget.style.boxShadow = ''}
    />
  );
}

function Textarea({ value, onChange, placeholder = '', rows = 3 }) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-md text-sm font-mono resize-none focus:outline-none"
      style={{
        backgroundColor: 'var(--bg-raised)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-primary)',
      }}
      onFocus={e  => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
      onBlur={e   => e.currentTarget.style.boxShadow = ''}
    />
  );
}

function SliderWithValue({ value, onChange, min, max, step = 1 }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-28 accent-[var(--brand)]"
      />
      <span
        className="w-8 text-center text-xs font-mono rounded px-1"
        style={{ backgroundColor: 'var(--brand-subtle)', color: 'var(--brand)' }}
      >
        {value}
      </span>
    </div>
  );
}

const selectStyle = {
  backgroundColor: 'var(--bg-raised)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
  minWidth: '180px',
};

// ── Tab contents ──────────────────────────────────────────────────────────────

function SpiderTab({ c, p }) {
  const [incStr, setIncStr] = useState((c.include_patterns || []).join('\n'));
  const [excStr, setExcStr] = useState((c.exclude_patterns || []).join('\n'));
  const parseLines = s => s.split('\n').map(x => x.trim()).filter(Boolean);

  return (
    <div>
      <SectionHeading>Crawl Limits</SectionHeading>

      <FieldRow label="Crawl depth" description="Max link hops from start URL">
        <SliderWithValue value={c.max_depth ?? 5} onChange={v => p({ max_depth: v })} min={1} max={25} />
      </FieldRow>

      <FieldRow label="Max URLs" description="Stop after crawling this many pages. 0 = no limit (crawls the whole site).">
        <NumberInput value={c.max_urls ?? 0} onChange={v => p({ max_urls: v })} min={0} max={1000000} step={1} />
      </FieldRow>

      <SectionHeading>What to Crawl</SectionHeading>

      <FieldRow label="Follow internal links">
        <Toggle checked={c.follow_internal ?? true} onChange={v => p({ follow_internal: v })} />
      </FieldRow>
      <FieldRow label="Follow external links" description="Crawl pages on other domains">
        <Toggle checked={c.follow_external ?? false} onChange={v => p({ follow_external: v })} />
      </FieldRow>
      <FieldRow label="Crawl images" description="Audit img src and srcset URLs">
        <Toggle checked={c.crawl_images ?? true} onChange={v => p({ crawl_images: v })} />
      </FieldRow>
      <FieldRow label="Crawl CSS" description="Follow links found in stylesheets">
        <Toggle checked={c.crawl_css ?? true} onChange={v => p({ crawl_css: v })} />
      </FieldRow>
      <FieldRow label="Crawl JavaScript" description="Render pages with a headless browser (slower, requires JS licence)">
        <Toggle checked={c.crawl_javascript ?? false} onChange={v => p({ crawl_javascript: v })} />
      </FieldRow>
      <FieldRow label="Crawl PDFs" description="Extract links and metadata from PDF files">
        <Toggle checked={c.crawl_pdfs ?? true} onChange={v => p({ crawl_pdfs: v })} />
      </FieldRow>
      <FieldRow label="Crawl hreflang" description="Follow hreflang alternate URLs">
        <Toggle checked={c.crawl_hreflang ?? true} onChange={v => p({ crawl_hreflang: v })} />
      </FieldRow>
      <FieldRow label="Crawl canonicals" description="Follow canonical URLs to their targets">
        <Toggle checked={c.crawl_canonicals ?? true} onChange={v => p({ crawl_canonicals: v })} />
      </FieldRow>

      <SectionHeading>User Agent</SectionHeading>

      <FieldRow label="User agent" description="Who the crawler identifies as to the target site">
        <UserAgentSelector
          value={c.user_agent ?? ''}
          onChange={v => p({ user_agent: v })}
        />
      </FieldRow>

      <SectionHeading>URL Filters</SectionHeading>

      <div className="py-3 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
            Include patterns <span style={{ color: 'var(--text-muted)' }}>(one per line — crawl only these paths)</span>
          </label>
          <Textarea
            rows={3}
            value={incStr}
            onChange={v => { setIncStr(v); p({ include_patterns: parseLines(v) }); }}
            placeholder={'/blog/\n/products/'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
            Exclude patterns <span style={{ color: 'var(--text-muted)' }}>(one per line — skip matching paths)</span>
          </label>
          <Textarea
            rows={3}
            value={excStr}
            onChange={v => { setExcStr(v); p({ exclude_patterns: parseLines(v) }); }}
            placeholder={'/wp-admin/\n/cdn-cgi/\n?utm_'}
          />
        </div>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function RobotsTab({ c, p }) {
  const [paramStr, setParamStr] = useState((c.strip_params_list || []).join('\n'));
  const parseLines = s => s.split('\n').map(x => x.trim()).filter(Boolean);

  return (
    <div>
      <SectionHeading>Robots Directives</SectionHeading>

      <FieldRow label="Respect robots.txt" description="Skip URLs that are disallowed in robots.txt">
        <Toggle checked={c.respect_robots_txt ?? true} onChange={v => p({ respect_robots_txt: v })} />
      </FieldRow>
      <FieldRow label="Obey noindex" description="Do not index pages with noindex meta tag or header">
        <Toggle checked={c.obey_noindex ?? true} onChange={v => p({ obey_noindex: v })} />
      </FieldRow>
      <FieldRow label="Obey nofollow" description="Do not follow links with rel=nofollow">
        <Toggle checked={c.obey_nofollow ?? true} onChange={v => p({ obey_nofollow: v })} />
      </FieldRow>
      <FieldRow label="Obey canonical" description="Skip non-canonical pages (treat canonical as the only version)">
        <Toggle checked={c.obey_canonical ?? false} onChange={v => p({ obey_canonical: v })} />
      </FieldRow>
      <FieldRow label="Process hreflang" description="Report hreflang conflicts and missing reciprocal annotations">
        <Toggle checked={c.obey_hreflang ?? true} onChange={v => p({ obey_hreflang: v })} />
      </FieldRow>

      <SectionHeading>URL Parameter Stripping</SectionHeading>

      <FieldRow label="Strip query parameters" description="Remove specified query params before de-duplicating URLs">
        <Toggle checked={c.strip_params ?? false} onChange={v => p({ strip_params: v })} />
      </FieldRow>

      {c.strip_params && (
        <div className="py-3">
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
            Parameters to strip <span style={{ color: 'var(--text-muted)' }}>(one per line)</span>
          </label>
          <Textarea
            rows={4}
            value={paramStr}
            onChange={v => { setParamStr(v); p({ strip_params_list: parseLines(v) }); }}
            placeholder={'utm_source\nutm_medium\nutm_campaign\nclickid'}
          />
        </div>
      )}

      <SectionHeading>HTTP Authentication</SectionHeading>

      <FieldRow label="Username" description="Basic auth credentials for password-protected sites">
        <TextInput
          value={c.basic_auth_user ?? ''}
          onChange={v => p({ basic_auth_user: v })}
          placeholder="username"
        />
      </FieldRow>

      <FieldRow label="Password" last>
        <TextInput
          type="password"
          value={c.basic_auth_pass ?? ''}
          onChange={v => p({ basic_auth_pass: v })}
          placeholder="••••••••"
        />
      </FieldRow>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SpeedTab({ c, p }) {
  const addHeader = () => {
    p({ custom_headers: [...(c.custom_headers || []), { name: '', value: '' }] });
  };
  const removeHeader = (i) => {
    const h = [...(c.custom_headers || [])];
    h.splice(i, 1);
    p({ custom_headers: h });
  };
  const updateHeader = (i, field, val) => {
    const h = [...(c.custom_headers || [])];
    h[i] = { ...h[i], [field]: val };
    p({ custom_headers: h });
  };

  return (
    <div>
      <SectionHeading>Crawl Speed</SectionHeading>

      <FieldRow label="Concurrency" description="Parallel requests — more = faster but heavier on the target server">
        <SliderWithValue value={c.threads ?? 5} onChange={v => p({ threads: v })} min={1} max={25} />
      </FieldRow>

      <SectionHeading>Custom HTTP Headers</SectionHeading>

      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Extra request headers sent with every crawl request (e.g. API keys, feature flags).
      </p>

      {(c.custom_headers || []).map((h, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={h.name}
            onChange={e => updateHeader(i, 'name', e.target.value)}
            placeholder="Header-Name"
            className="flex-1 h-8 px-2 rounded text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
            onFocus={e  => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
            onBlur={e   => e.currentTarget.style.boxShadow = ''}
          />
          <input
            type="text"
            value={h.value}
            onChange={e => updateHeader(i, 'value', e.target.value)}
            placeholder="header-value"
            className="flex-1 h-8 px-2 rounded text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
            onFocus={e  => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
            onBlur={e   => e.currentTarget.style.boxShadow = ''}
          />
          <button
            type="button"
            onClick={() => removeHeader(i)}
            className="w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors"
            style={{ color: 'var(--severity-critical)', backgroundColor: 'var(--severity-critical-bg)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addHeader}
        className="flex items-center gap-1.5 text-sm mt-2 px-3 h-8 rounded transition-colors"
        style={{
          color: 'var(--brand)',
          backgroundColor: 'var(--brand-subtle)',
          border: '1px dashed var(--brand)',
        }}
      >
        <Plus className="w-3.5 h-3.5" />
        Add header
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function CustomTab({ c, p }) {
  const addExtraction = () => {
    p({
      custom_extractions: [
        ...(c.custom_extractions || []),
        { label: '', selector: '', extract: 'text', attribute: '' },
      ],
    });
  };
  const removeExtraction = (i) => {
    const ex = [...(c.custom_extractions || [])];
    ex.splice(i, 1);
    p({ custom_extractions: ex });
  };
  const updateExtraction = (i, field, val) => {
    const ex = [...(c.custom_extractions || [])];
    ex[i] = { ...ex[i], [field]: val };
    p({ custom_extractions: ex });
  };

  return (
    <div>
      <SectionHeading>Custom Extraction</SectionHeading>

      <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Extract additional data from each crawled page using CSS selectors.
        Results appear as extra columns in the crawl export CSV.
      </p>

      {(c.custom_extractions || []).length === 0 && (
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          No custom extractions configured.
        </p>
      )}

      {(c.custom_extractions || []).map((ex, i) => (
        <div
          key={i}
          className="rounded-lg p-4 mb-3"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Extraction #{i + 1}
            </p>
            <button
              type="button"
              onClick={() => removeExtraction(i)}
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ color: 'var(--severity-critical)', backgroundColor: 'var(--severity-critical-bg)' }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Label</label>
                <input
                  type="text"
                  value={ex.label}
                  onChange={e => updateExtraction(i, 'label', e.target.value)}
                  placeholder="e.g. Price"
                  className="w-full h-8 px-2 rounded text-sm focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e  => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                  onBlur={e   => e.currentTarget.style.boxShadow = ''}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Extract</label>
                <select
                  value={ex.extract}
                  onChange={e => updateExtraction(i, 'extract', e.target.value)}
                  className="h-8 px-2 rounded text-sm focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    minWidth: '120px',
                  }}
                >
                  <option value="text">Text</option>
                  <option value="html">HTML</option>
                  <option value="attribute">Attribute</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>CSS selector</label>
              <input
                type="text"
                value={ex.selector}
                onChange={e => updateExtraction(i, 'selector', e.target.value)}
                placeholder="e.g. .product-price span"
                className="w-full h-8 px-2 rounded text-sm font-mono focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e  => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                onBlur={e   => e.currentTarget.style.boxShadow = ''}
              />
            </div>

            {ex.extract === 'attribute' && (
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Attribute name</label>
                <input
                  type="text"
                  value={ex.attribute}
                  onChange={e => updateExtraction(i, 'attribute', e.target.value)}
                  placeholder="e.g. data-sku"
                  className="w-full h-8 px-2 rounded text-sm font-mono focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e  => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                  onBlur={e   => e.currentTarget.style.boxShadow = ''}
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addExtraction}
        className="flex items-center gap-1.5 text-sm px-3 h-8 rounded transition-colors"
        style={{
          color: 'var(--brand)',
          backgroundColor: 'var(--brand-subtle)',
          border: '1px dashed var(--brand)',
        }}
      >
        <Plus className="w-3.5 h-3.5" />
        Add extraction
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ApisTab() {
  return (
    <div className="py-4 space-y-4">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        API integrations (Google Search Console, Google Analytics 4, PageSpeed Insights,
        Majestic, Ahrefs, Moz) are connected at the platform level via{' '}
        <strong style={{ color: 'var(--text-primary)' }}>Integration Hub</strong>.
      </p>

      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Once connected, each site can have its own GSC property and GA4 property ID — configure
        these in the <strong style={{ color: 'var(--text-primary)' }}>Site Details</strong> step
        of this wizard, or by editing the site from the Sites page.
      </p>

      <div
        className="rounded-lg p-4"
        style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
          API data injected into each crawl
        </p>
        <ul className="text-sm space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
          <li>• <strong style={{ color: 'var(--text-primary)' }}>GSC</strong> — impressions, clicks, CTR, average position per URL</li>
          <li>• <strong style={{ color: 'var(--text-primary)' }}>GA4</strong> — sessions, bounce rate, conversions per URL</li>
          <li>• <strong style={{ color: 'var(--text-primary)' }}>PageSpeed Insights</strong> — CWV scores (LCP, CLS, FID/INP)</li>
        </ul>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CrawlConfigPanel({ config = DEFAULT_CONFIG, onChange }) {
  const [activeTab, setActiveTab] = useState('spider');

  // patch merges partial changes into the full config and calls onChange once
  const patch = (partial) => onChange?.({ ...config, ...partial });

  return (
    <div
      className="flex rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border-default)', minHeight: '480px' }}
    >
      {/* Left sidebar nav */}
      <div
        className="flex flex-col py-3 shrink-0"
        style={{
          width: '160px',
          backgroundColor: 'var(--bg-raised)',
          borderRight: '1px solid var(--border-default)',
        }}
      >
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 h-9 px-3 mx-2 rounded-md text-sm transition-colors text-left"
              style={{
                backgroundColor: active ? 'var(--brand-subtle)' : 'transparent',
                color: active ? 'var(--brand-text)' : 'var(--text-muted)',
                fontWeight: active ? 500 : 400,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'var(--bg-surface)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Right panel */}
      <div
        className="flex-1 overflow-y-auto px-5 pb-4"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        {activeTab === 'spider' && <SpiderTab c={config} p={patch} />}
        {activeTab === 'robots' && <RobotsTab c={config} p={patch} />}
        {activeTab === 'speed'  && <SpeedTab  c={config} p={patch} />}
        {activeTab === 'custom' && <CustomTab c={config} p={patch} />}
        {activeTab === 'apis'   && <ApisTab />}
      </div>
    </div>
  );
}
