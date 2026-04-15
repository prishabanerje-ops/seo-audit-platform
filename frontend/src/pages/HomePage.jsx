import { useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Search, Zap, BarChart3, GitBranch, Bell, Shield,
  ArrowRight, CheckCircle2, Globe, FileSearch, Gauge,
} from 'lucide-react';

/* ─── Design tokens (dark theme hard-coded for the homepage) ──────────────── */
const T = {
  bg:         '#080a10',
  bgSurface:  '#0f1117',
  bgRaised:   '#14172020',
  border:     '#1e2235',
  borderGlow: 'rgba(99,102,241,0.25)',
  brand:      '#6366f1',
  brandGlow:  'rgba(99,102,241,0.15)',
  brandDim:   'rgba(99,102,241,0.08)',
  text:       '#e2e8f0',
  textSub:    '#94a3b8',
  textMuted:  '#4a5568',
};

/* ─── Animated dot-grid canvas background ─────────────────────────────────── */
function DotGrid() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let w, h, dots, raf;
    const GAP = 32;

    function resize() {
      w = canvas.width  = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      dots = [];
      for (let x = GAP; x < w; x += GAP) {
        for (let y = GAP; y < h; y += GAP) {
          dots.push({ x, y, base: Math.random() * Math.PI * 2 });
        }
      }
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      dots.forEach(d => {
        const pulse = 0.15 + 0.12 * Math.sin(t * 0.0005 + d.base);
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${pulse})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

/* ─── Feature card data ───────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: FileSearch,
    title: '477+ SEO Checks',
    desc:  'Exhaustive coverage across indexability, canonicals, hreflang, structured data, security, and more.',
  },
  {
    icon: Zap,
    title: 'AI Fix Recommendations',
    desc:  'Claude Sonnet analyzes every issue and streams a precise, context-aware fix directly in the platform.',
  },
  {
    icon: BarChart3,
    title: 'GSC & GA4 Integration',
    desc:  'Overlay real search performance data — impressions, clicks, positions — on top of technical findings.',
  },
  {
    icon: Gauge,
    title: 'Core Web Vitals',
    desc:  'PageSpeed Insights data mapped to audited URLs. See LCP, INP, and CLS next to crawl results.',
  },
  {
    icon: GitBranch,
    title: 'Crawl-to-Task Pipeline',
    desc:  'Auto-generate developer tasks from audit findings. Push to Linear or track natively.',
  },
  {
    icon: Bell,
    title: 'Scheduled Audits',
    desc:  'Set recurring crawl schedules and receive Slack alerts when critical issues regress.',
  },
];

const STATS = [
  { value: '477+',   label: 'SEO checks' },
  { value: 'AI',     label: 'Fix recommendations' },
  { value: 'GSC',    label: '+ GA4 overlay' },
  { value: 'SQLite', label: 'Zero infrastructure' },
];

/* ─── Main component ──────────────────────────────────────────────────────── */
export function HomePage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) navigate('/admin', { replace: true });
  }, [user, isLoading, navigate]);

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.text, fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 2rem', height: '56px',
        borderBottom: `1px solid ${T.border}`,
        background: `${T.bg}e6`,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: T.brand,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Search size={14} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', color: T.text }}>
            SEO Audit Platform
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
            color: T.brand, padding: '2px 6px',
            border: `1px solid ${T.borderGlow}`,
            borderRadius: 4, textTransform: 'uppercase',
          }}>v2.0</span>
        </div>

        <Link
          to="/login"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 7,
            background: T.brand, color: '#fff',
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Sign In <ArrowRight size={13} />
        </Link>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        padding: '100px 2rem 80px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        <DotGrid />

        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
          width: 800, height: 400, borderRadius: '50%',
          background: T.brand, opacity: 0.045,
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 760 }}>
          {/* Eyebrow */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 999,
            border: `1px solid ${T.borderGlow}`,
            background: T.brandDim,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
            color: '#818cf8', textTransform: 'uppercase',
            marginBottom: 28,
          }}>
            <Globe size={11} /> Self-Hosted · Technical SEO
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "'Syne', system-ui, sans-serif",
            fontSize: 'clamp(40px, 7vw, 76px)',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            marginBottom: 24,
            background: `linear-gradient(135deg, #e2e8f0 30%, #818cf8 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Diagnose every<br />SEO issue. Fix it<br />with AI.
          </h1>

          <p style={{
            fontSize: 17, color: T.textSub, lineHeight: 1.65,
            maxWidth: 500, margin: '0 auto 40px',
          }}>
            A self-hosted SEO audit platform that crawls your sites via Screaming Frog, detects 477+ technical issues, and streams Claude AI fix recommendations — all in one place.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/login"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 28px', borderRadius: 9,
                background: T.brand, color: '#fff',
                fontSize: 15, fontWeight: 700, textDecoration: 'none',
                boxShadow: `0 0 32px ${T.brandGlow}`,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
            >
              Open Platform <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <section style={{
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        padding: '24px 2rem',
        display: 'flex', justifyContent: 'center',
        background: T.bgSurface,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0',
          maxWidth: 700, width: '100%',
        }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{
              textAlign: 'center', padding: '12px 16px',
              borderRight: i < STATS.length - 1 ? `1px solid ${T.border}` : 'none',
            }}>
              <div style={{
                fontFamily: "'Syne', system-ui, sans-serif",
                fontSize: 24, fontWeight: 800,
                color: T.brand, letterSpacing: '-0.02em',
                marginBottom: 2,
              }}>{s.value}</div>
              <div style={{ fontSize: 12, color: T.textSub, letterSpacing: '0.01em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 2rem', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{
            fontFamily: "'Syne', system-ui, sans-serif",
            fontSize: 'clamp(26px, 4vw, 38px)',
            fontWeight: 800, letterSpacing: '-0.025em',
            color: T.text, marginBottom: 12,
          }}>
            Everything your SEO team needs
          </h2>
          <p style={{ fontSize: 15, color: T.textSub, maxWidth: 440, margin: '0 auto' }}>
            Built for in-house SEO engineers who need complete visibility and fast fixes.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}>
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <FeatureCard key={title} icon={Icon} title={title} desc={desc} />
          ))}
        </div>
      </section>

      {/* ── CTA banner ──────────────────────────────────────────────────── */}
      <section style={{
        margin: '0 2rem 72px',
        maxWidth: 1080, marginLeft: 'auto', marginRight: 'auto',
      }}>
        <div style={{
          position: 'relative', overflow: 'hidden',
          borderRadius: 16,
          border: `1px solid ${T.borderGlow}`,
          background: `linear-gradient(135deg, ${T.bgSurface} 0%, #13152a 100%)`,
          padding: '52px 48px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 24,
        }}>
          {/* Glow blob */}
          <div style={{
            position: 'absolute', right: -60, top: '50%', transform: 'translateY(-50%)',
            width: 320, height: 320, borderRadius: '50%',
            background: T.brand, opacity: 0.07, filter: 'blur(60px)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: 460 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {['No cloud dependencies', 'Your data stays local', 'Claude AI included'].map(t => (
                <span key={t} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 600, color: '#6ee7b7',
                  letterSpacing: '0.04em',
                }}>
                  <CheckCircle2 size={11} /> {t}
                </span>
              ))}
            </div>
            <h3 style={{
              fontFamily: "'Syne', system-ui, sans-serif",
              fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800,
              color: T.text, letterSpacing: '-0.02em', marginBottom: 10,
            }}>
              Ready to audit your first site?
            </h3>
            <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.6 }}>
              Sign in to access the platform. Your admin account is already configured.
            </p>
          </div>

          <Link
            to="/login"
            style={{
              position: 'relative', zIndex: 1,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '13px 30px', borderRadius: 9,
              background: T.brand, color: '#fff',
              fontSize: 15, fontWeight: 700, textDecoration: 'none',
              boxShadow: `0 0 40px ${T.brandGlow}`,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
          >
            Sign In <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: `1px solid ${T.border}`,
        padding: '20px 2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: T.brand }} />
          <span style={{ fontSize: 12, color: T.textMuted }}>SEO Audit Platform v2.0.0</span>
        </div>
        <span style={{ fontSize: 12, color: T.textMuted }}>
          Self-hosted · Powered by Claude AI
        </span>
      </footer>
    </div>
  );
}

/* ─── Feature card ────────────────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, desc }) {
  const ref = useRef(null);

  return (
    <div
      ref={ref}
      style={{
        padding: '24px',
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        background: T.bgSurface,
        transition: 'border-color 0.2s, transform 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = T.borderGlow;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.transform = 'none';
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: T.brandDim,
        border: `1px solid ${T.borderGlow}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
        color: '#818cf8',
      }}>
        <Icon size={18} />
      </div>
      <h3 style={{
        fontSize: 14, fontWeight: 700, color: T.text,
        marginBottom: 8, letterSpacing: '-0.01em',
      }}>{title}</h3>
      <p style={{ fontSize: 13, color: T.textSub, lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}
