import { useNavigate } from 'react-router';
import { ShieldOff } from 'lucide-react';

export function AccessExpired() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <div className="w-full max-w-sm text-center">
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-6 flex items-center justify-center"
          style={{ backgroundColor: 'var(--severity-critical-bg)', border: '1px solid var(--severity-critical-border)' }}
        >
          <ShieldOff className="w-7 h-7" style={{ color: 'var(--severity-critical-text)' }} />
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Account Access Expired
        </h1>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Your company's subscription is inactive or has expired. Please contact your
          account administrator to restore access.
        </p>

        <button
          onClick={() => navigate('/login', { replace: true })}
          className="w-full h-10 rounded-md text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: 'var(--brand)' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--brand-hover)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--brand)'}
        >
          Back to Login
        </button>

        <p className="mt-8 text-xs" style={{ color: 'var(--text-muted)' }}>
          SEO Audit Platform v2.0.0
        </p>
      </div>
    </div>
  );
}
