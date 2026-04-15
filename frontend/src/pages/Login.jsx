import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Eye, EyeOff, Loader2, ShieldCheck, Zap, Lock } from 'lucide-react';
import api from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { setUser } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [show,     setShow]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const from = location.state?.from?.pathname || '/admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      setUser(res.data.user);
      navigate(from, { replace: true });
    } catch (err) {
      if (err.response?.status === 402) {
        navigate('/access-expired', { replace: true });
        return;
      }
      if (err.response?.status === 403 && err.response?.data?.error === 'password_reset_required') {
        navigate('/change-password', { state: { email }, replace: true });
        return;
      }
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-center px-16"
        style={{ background: 'linear-gradient(135deg, var(--bg-base) 0%, var(--bg-surface) 100%)' }}
      >
        {/* Radial glow */}
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
            Self-hosted technical SEO analysis tool
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

      {/* Right panel — form */}
      <div
        className="flex-1 flex items-center justify-center px-6 lg:px-16"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              Sign in
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Enter your credentials to access the platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                Email address
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com" required autoFocus
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
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password" required
                  className="w-full h-10 px-3 pr-10 rounded-md text-sm placeholder:text-[var(--text-muted)] focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                  onBlur={e  => e.currentTarget.style.boxShadow = ''}
                />
                <button
                  type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-md" style={{ backgroundColor: 'var(--severity-critical-bg)', border: '1px solid var(--severity-critical-border)' }}>
                <p className="text-sm" style={{ color: 'var(--severity-critical-text)' }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              className="w-full h-10 rounded-md text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors"
              style={{ backgroundColor: 'var(--brand)', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--brand-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--brand)'; }}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign In'}
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
