/**
 * Startup environment validation.
 * In production: missing required vars → log error + process.exit(1)
 * In development: missing required vars → log warning, continue
 */

const REQUIRED_IN_PRODUCTION = ['JWT_SECRET', 'FRONTEND_URL'];

const OPTIONAL_WITH_WARNINGS = [
  { key: 'ANTHROPIC_API_KEY', warning: 'AI recommendations disabled — set ANTHROPIC_API_KEY' },
  { key: 'GOOGLE_CLIENT_ID',  warning: 'GSC/GA4 OAuth disabled — set GOOGLE_CLIENT_ID' },
  { key: 'PSI_API_KEY',       warning: 'PageSpeed Insights will use unauthenticated (rate-limited) requests' },
];

export function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const rows = [];
  let hasError = false;

  // Check required-in-production vars
  for (const key of REQUIRED_IN_PRODUCTION) {
    const val = process.env[key];
    const status = val ? 'SET' : 'MISSING';
    rows.push({ key, status });
    if (!val && isProduction) {
      console.error(`[validate-env] ✗ REQUIRED env var missing: ${key}`);
      hasError = true;
    } else if (!val) {
      console.warn(`[validate-env] ⚠  ${key} not set (required in production)`);
    }
  }

  // Check optional vars (warn if missing)
  for (const { key, warning } of OPTIONAL_WITH_WARNINGS) {
    const val = process.env[key];
    const status = val ? 'SET' : 'MISSING';
    rows.push({ key, status });
    if (!val) {
      console.warn(`[validate-env] ℹ  ${key} not set — ${warning}`);
    }
  }

  // Print summary table
  const maxKey = Math.max(...rows.map(r => r.key.length));
  console.log('\n[validate-env] Environment status:');
  for (const { key, status } of rows) {
    const icon = status === 'SET' ? '✓' : '✗';
    console.log(`  ${icon} ${key.padEnd(maxKey)}  ${status}`);
  }
  console.log('');

  if (hasError) {
    console.error('[validate-env] Aborting: required vars missing in production.');
    process.exit(1);
  }
}
