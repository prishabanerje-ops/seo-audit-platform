import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Loader2, AlertCircle } from 'lucide-react';
import api from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export function InviteAccept() {
  const navigate        = useNavigate();
  const [params]        = useSearchParams();
  const { setUser }     = useAuth();

  const token = params.get('token') || '';

  const [validating, setValidating] = useState(true);
  const [inviteInfo,  setInviteInfo] = useState(null); // { email, role }
  const [tokenError,  setTokenError] = useState('');

  const [name,     setName]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  /* Validate token on mount */
  useEffect(() => {
    if (!token) {
      setTokenError('No invite token found in the URL.');
      setValidating(false);
      return;
    }
    api.get(`/auth/invite/validate?token=${token}`)
      .then(res => { setInviteInfo(res.data); })
      .catch(err => { setTokenError(err.response?.data?.error || 'Invalid or expired invite link.'); })
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      const res = await api.post('/auth/invite/accept', { token, name, password });
      setUser(res.data.user);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not complete signup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="w-10 h-10 rounded-xl mb-6 mx-auto" style={{ backgroundColor: 'var(--brand)' }} />

        {validating ? (
          <div className="flex items-center justify-center gap-2 py-8" style={{ color: 'var(--text-muted)' }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Validating invite…</span>
          </div>
        ) : tokenError ? (
          <div
            className="p-4 rounded-xl text-center"
            style={{ backgroundColor: 'var(--severity-critical-bg)', border: '1px solid var(--severity-critical-border)' }}
          >
            <AlertCircle className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--severity-critical)' }} />
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--severity-critical-text)' }}>Invite invalid</p>
            <p className="text-xs" style={{ color: 'var(--severity-critical-text)' }}>{tokenError}</p>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                Accept Invitation
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                You've been invited as <strong style={{ color: 'var(--text-primary)' }}>{inviteInfo?.role}</strong>
              </p>
              {inviteInfo?.email && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {inviteInfo.email}
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : 'Create Account'}
              </button>
            </form>
          </>
        )}

        <p className="mt-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          SEO Audit Platform v2.0.0
        </p>
      </div>
    </div>
  );
}
