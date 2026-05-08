import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, Circle, Loader2, ShieldCheck, Zap, Lock } from 'lucide-react';
import api from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

function CheckRow({ label, status }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {status === 'checking' && <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: 'var(--text-muted)' }} />}
      {status === 'ok'       && <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--severity-pass)' }} />}
      {status === 'warn'     && <Circle className="w-4 h-4 shrink-0" style={{ color: 'var(--severity-warning)' }} />}
      {status === 'idle'     && <Circle className="w-4 h-4 shrink-0" style={{ color: 'var(--border-default)' }} />}
      <span className="text-sm" style={{ color: status === 'ok' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );
}

export function Setup() {
  const navigate   = useNavigate();
  const { setUser } = useAuth();

  const [checks, setChecks] = useState({
    db:        'idle',
    anthropic: 'idle',
  });

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  /* Check setup-status on mount — redirect to /login if already configured */
  useEffect(() => {
    api.get('/auth/setup-status').then(res => {
      if (!res.data.needsSetup) {
        navigate('/login', { replace: true });
      }
    }).catch(() => {});
  }, [navigate]);

  /* Run health checks on mount */
  useEffect(() => {
    setChecks({ db: 'checking', anthropic: 'idle' });

    api.get('/health')
      .then(res => {
        const { db, anthropic } = res.data;
        setChecks({
          db:        db        === 'ok' ? 'ok' : 'warn',
          anthropic: anthropic === 'ok' ? 'ok' : 'warn',
        });
      })
      .catch(() => {
        setChecks({ db: 'warn', anthropic: 'warn' });
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register', { name, email, password });
      setUser(res.data.user);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-center px-16"
        style={{ background: 'linear-gradient(135deg, var(--bg-base) 0%, var(--bg-surface) 100%)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 30% 50%, var(--brand) 0%, transparent 60%)', opacity: 0.06 }}
        />
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-xl mb-6" style={{ backgroundColor: 'var(--brand)' }} />
          <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            SEO Audit Platform
          </h1>
          <p className="text-lg mb-12" style={{ color: 'var(--text-muted)' }}>
            First-time setup — get started in seconds
          </p>
          <div className="space-y-6">
            {[
              { icon: ShieldCheck, title: '204 SEO Checks', desc: 'Comprehensive technical audit coverage' },
              { icon: Zap,         title: 'AI-Powered Fixes', desc: 'Intelligent recommendations via Claude' },
              { icon: Lock,        title: 'Self-Hosted & Private', desc: 'Your data stays on your infrastructure' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--brand-subtle)', color: 'var(--brand)' }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div
        className="flex-1 flex items-center justify-center px-6 lg:px-16"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              Create your account
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              You'll be the platform admin with full access.
            </p>
          </div>

          {/* System checks */}
          <div
            className="rounded-lg p-4 mb-6"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              System checks
            </p>
            <CheckRow label="Database"       status={checks.db} />
            <CheckRow label="Anthropic API"  status={checks.anthropic} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                Full name
              </label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name" required autoFocus
                className="w-full h-10 px-3 rounded-md text-sm placeholder:text-[var(--text-muted)] focus:outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                onBlur={e  => e.currentTarget.style.boxShadow = ''}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                Email address
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com" required
                className="w-full h-10 px-3 rounded-md text-sm placeholder:text-[var(--text-muted)] focus:outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                onBlur={e  => e.currentTarget.style.boxShadow = ''}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters" required
                className="w-full h-10 px-3 rounded-md text-sm placeholder:text-[var(--text-muted)] focus:outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                onBlur={e  => e.currentTarget.style.boxShadow = ''}
              />
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                Confirm password
              </label>
              <input
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter password" required
                className="w-full h-10 px-3 rounded-md text-sm placeholder:text-[var(--text-muted)] focus:outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                onBlur={e  => e.currentTarget.style.boxShadow = ''}
              />
            </div>

            {error && (
              <div className="p-3 rounded-md" style={{ backgroundColor: 'var(--severity-critical-bg)', border: '1px solid var(--severity-critical-border)' }}>
                <p className="text-sm" style={{ color: 'var(--severity-critical-text)' }}>{error}</p>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full h-10 rounded-md text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors"
              style={{ backgroundColor: 'var(--brand)', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--brand-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--brand)'; }}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</> : 'Create Admin Account'}
            </button>
          </form>

          <p className="mt-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            SEO Audit Platform v2.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
