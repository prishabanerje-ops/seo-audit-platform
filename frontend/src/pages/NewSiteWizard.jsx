/**
 * NewSiteWizard — 5-step wizard for registering a new site.
 *
 * Step 1: Basic info (name, URL, colour)
 * Step 2: Integrations (GSC property, GA4 property ID)
 * Step 3: Crawl configuration (CrawlConfigPanel)
 * Step 4: Connect APIs (OAuth placeholders)
 * Step 5: Review + Create
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Globe, Check, ExternalLink, Activity } from 'lucide-react';
import { useSites }        from '../context/SitesContext.jsx';
import { useToast }        from '../context/ToastContext.jsx';
import { Button }          from '../components/ui/Button.jsx';
import { Input }           from '../components/ui/Input.jsx';
import { WizardSteps }     from '../components/WizardSteps.jsx';
import { CrawlConfigPanel, DEFAULT_CONFIG } from '../components/CrawlConfigPanel.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Basic info'    },
  { label: 'Integrations' },
  { label: 'Crawl config' },
  { label: 'Connect APIs' },
  { label: 'Review'       },
];

const COLOR_PRESETS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

// ── Sub-components ────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {COLOR_PRESETS.map(c => (
        <button
          key={c} type="button"
          onClick={() => onChange(c)}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
          style={{ backgroundColor: c, boxShadow: value === c ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${c}` : 'none' }}
          title={c}
        >
          {value === c && <Check className="w-3.5 h-3.5 text-white" />}
        </button>
      ))}
    </div>
  );
}

function Card({ children }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
    >
      {children}
    </div>
  );
}

function CardHeading({ children, sub }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</h2>
      {sub && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function ReviewRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between py-2.5"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] break-all"
        style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

// ── Step pages ────────────────────────────────────────────────────────────────

function Step1({ label, setLabel, url, setUrl, color, setColor, errors, setErrors }) {
  return (
    <Card>
      <CardHeading sub="This information is used across all dashboards and reports.">
        Site details
      </CardHeading>
      <div className="space-y-4">
        <Input
          label="Site name"
          placeholder="e.g. My Company Blog"
          value={label}
          onChange={e => { setLabel(e.target.value); setErrors(v => ({ ...v, label: '' })); }}
          error={errors.label}
          required
        />
        <Input
          label="Root URL"
          placeholder="https://www.example.com"
          value={url}
          onChange={e => { setUrl(e.target.value); setErrors(v => ({ ...v, url: '' })); }}
          error={errors.url}
          type="url"
          required
        />
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            Colour
          </label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>
    </Card>
  );
}

function Step2({ gsc, setGsc, ga4, setGa4 }) {
  return (
    <Card>
      <CardHeading sub="Optional — you can add these later in Settings → Integrations.">
        Property IDs
      </CardHeading>
      <div className="space-y-4">
        <Input
          label="Google Search Console property"
          placeholder="sc-domain:example.com  or  https://www.example.com/"
          value={gsc}
          onChange={e => setGsc(e.target.value)}
        />
        <Input
          label="Google Analytics 4 property ID"
          placeholder="G-XXXXXXXXXX  or  123456789"
          value={ga4}
          onChange={e => setGa4(e.target.value)}
        />
      </div>
    </Card>
  );
}

function Step3({ crawlConfig, setCrawlConfig }) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Crawl configuration
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          These defaults apply to every crawl run on this site. You can override them per crawl.
        </p>
      </div>
      <CrawlConfigPanel config={crawlConfig} onChange={setCrawlConfig} />
    </div>
  );
}

function Step4({ siteUrl }) {
  const integrations = [
    {
      name: 'Google Search Console',
      description: 'Import impressions, clicks, and position data alongside audit results.',
      href: '/integrations',
    },
    {
      name: 'Google Analytics 4',
      description: 'Overlay sessions, bounce rate, and conversions on your audit pages.',
      href: '/integrations',
    },
    {
      name: 'Linear',
      description: 'Push audit issues directly to your Linear workspace as tickets.',
      href: '/integrations',
    },
  ];

  return (
    <Card>
      <CardHeading sub="Connect these services after creating your site. All are optional.">
        Connect APIs
      </CardHeading>
      <div className="space-y-3">
        {integrations.map(int => (
          <div
            key={int.name}
            className="flex items-start justify-between gap-4 p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{int.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{int.description}</p>
            </div>
            <a
              href={int.href}
              className="flex items-center gap-1 text-xs shrink-0 mt-0.5"
              style={{ color: 'var(--brand)' }}
            >
              Configure <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ))}
      </div>
      <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
        You can connect all integrations at any time via <strong>Settings → Integrations</strong>.
      </p>
    </Card>
  );
}

function Step5({ label, url, color, gsc, ga4, crawlConfig }) {
  const configSummary = [
    `Depth: ${crawlConfig.max_depth}`,
    `Max URLs: ${crawlConfig.max_urls === 0 ? 'Unlimited' : crawlConfig.max_urls?.toLocaleString()}`,
    crawlConfig.crawl_javascript ? 'JS rendering: on' : null,
  ].filter(Boolean).join(' · ');

  return (
    <Card>
      <CardHeading sub="Review your settings before creating the site.">
        Confirm &amp; create
      </CardHeading>

      {/* Site preview */}
      <div className="flex items-center gap-3 mb-5 p-3 rounded-lg"
        style={{ backgroundColor: 'var(--bg-raised)' }}>
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{url}</p>
        </div>
      </div>

      <div>
        <ReviewRow label="Site name"     value={label} />
        <ReviewRow label="Root URL"      value={url} />
        <ReviewRow label="GSC property"  value={gsc  || '—'} />
        <ReviewRow label="GA4 property"  value={ga4  || '—'} />
        <ReviewRow label="Crawl config"  value={configSummary} />
      </div>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NewSiteWizard() {
  const navigate       = useNavigate();
  const { createSite } = useSites();
  const { toast }      = useToast();

  const [step,        setStep]        = useState(1);
  const [label,       setLabel]       = useState('');
  const [url,         setUrl]         = useState('');
  const [color,       setColor]       = useState('#6366f1');
  const [gsc,         setGsc]         = useState('');
  const [ga4,         setGa4]         = useState('');
  const [crawlConfig, setCrawlConfig] = useState({ ...DEFAULT_CONFIG });
  const [errors,      setErrors]      = useState({});
  const [loading,     setLoading]     = useState(false);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateStep1 = () => {
    const e = {};
    if (!label.trim())   e.label = 'Site name is required';
    if (!url.trim())     e.url   = 'URL is required';
    else { try { new URL(url); } catch { e.url = 'Must be a valid URL (include https://)'; } }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => s - 1);

  const handleCreate = async () => {
    setLoading(true);
    try {
      await createSite({
        label:           label.trim(),
        url:             url.trim().replace(/\/$/, ''),
        color,
        gsc_property:    gsc.trim(),
        ga4_property_id: ga4.trim(),
        crawl_config:    JSON.stringify(crawlConfig),
      });
      toast.success(`"${label}" created`);
      navigate('/sites');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create site');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--brand-subtle)', color: 'var(--brand)' }}
          >
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Add new site
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Register a site to start running SEO audits
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="mb-8">
          <WizardSteps
            steps={STEPS}
            currentStep={step}
            onStepClick={setStep}
          />
        </div>

        {/* Step content */}
        <div className="mb-6">
          {step === 1 && (
            <Step1
              label={label} setLabel={setLabel}
              url={url}     setUrl={setUrl}
              color={color} setColor={setColor}
              errors={errors} setErrors={setErrors}
            />
          )}
          {step === 2 && (
            <Step2
              gsc={gsc} setGsc={setGsc}
              ga4={ga4} setGa4={setGa4}
            />
          )}
          {step === 3 && (
            <Step3
              crawlConfig={crawlConfig}
              setCrawlConfig={setCrawlConfig}
            />
          )}
          {step === 4 && <Step4 siteUrl={url} />}
          {step === 5 && (
            <Step5
              label={label} url={url} color={color}
              gsc={gsc} ga4={ga4}
              crawlConfig={crawlConfig}
            />
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <Button
            variant="secondary"
            onClick={step === 1 ? () => navigate('/sites') : handleBack}
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </Button>

          {step < 5 ? (
            <Button onClick={handleNext}>
              Next →
            </Button>
          ) : (
            <Button
              loading={loading}
              iconLeft={<Activity className="w-4 h-4" />}
              onClick={handleCreate}
            >
              Create site
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
