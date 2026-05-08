import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import api from '../api/index.js';

export function ChangePassword() {
  const navigate  = useNavigate();
  const location  = useLocation();

  // Login.jsx passes the email via location state so user doesn't retype it
  const [email,           setEmail]           = useState(location.state?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [showCurrent,     setShowCurrent]     = useState(false);
  const [showNew,         setShowNew]         = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { email, currentPassword, newPassword });
      navigate('/login', { state: { notice: 'Password changed. Please sign in.' }, replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Password change failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
          style={{ backgroundColor: 'var(--severity-warning-bg)', color: 'var(--severity-warning)' }}
        >
          <ShieldAlert className="w-6 h-6" />
        </div>

        <h2 className="text-2xl font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
          Set a new password
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          Your account was created with a temporary password. You must set a new one before continuing.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Current password */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
              Current (temporary) password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'} value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Your temporary password" required
                className="w-full h-10 px-3 pr-10 rounded-md text-sm placeholder:text-[var(--text-muted)] focus:outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                onBlur={e  => e.currentTarget.style.boxShadow = ''}
              />
              <button type="button" onClick={() => setShowCurrent(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
              New password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'} value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters" required minLength={8}
                className="w-full h-10 px-3 pr-10 rounded-md text-sm placeholder:text-[var(--text-muted)] focus:outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                onBlur={e  => e.currentTarget.style.boxShadow = ''}
              />
              <button type="button" onClick={() => setShowNew(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
