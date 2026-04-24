/**
 * @module routes/psi
 * PageSpeed Insights (PSI) API v5 — analyze a URL for Core Web Vitals & performance score.
 */
import { Router }     from 'express';
import { psiLimiter } from '../middleware/rateLimiter.js';
import { getGlobalSetting } from '../services/secret-store.js';

const router = Router();

// ─── GET /api/psi/analyze ─────────────────────────────────────────────────────
/**
 * @route GET /api/psi/analyze
 * @desc  Runs a PageSpeed Insights analysis for a given URL.
 * @access auth
 */
router.get('/analyze', psiLimiter, async (req, res) => {
  try {
    const { url, strategy = 'mobile' } = req.query;

    // 1. Validate url
    if (!url) {
      return res.status(400).json({ error: 'url query parameter is required' });
    }
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'url must be a valid URL (e.g. https://example.com)' });
    }

    // 2. Validate strategy
    if (strategy !== 'mobile' && strategy !== 'desktop') {
      return res.status(400).json({ error: 'strategy must be "mobile" or "desktop"' });
    }

    // 3. Resolve PSI API key
    const apiKey = process.env.PSI_API_KEY || getGlobalSetting('psi_api_key');
    if (!apiKey) {
      return res.status(503).json({
        error: 'PSI API key not configured. Add PSI_API_KEY to .env or Settings.',
      });
    }

    // 4. Call Google PageSpeed Insights API v5
    const psiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    psiUrl.searchParams.set('url', url);
    psiUrl.searchParams.set('strategy', strategy);
    psiUrl.searchParams.set('key', apiKey);

    const psiRes = await fetch(psiUrl.toString());

    // 5. Handle PSI API errors — check ok before parsing body (non-JSON bodies e.g. HTML 429 would throw)
    if (!psiRes.ok) {
      let message = `PSI API returned status ${psiRes.status}`;
      try { message = (await psiRes.json())?.error?.message || message; } catch (_) {}
      return res.status(502).json({ error: message });
    }

    const psiData = await psiRes.json();

    // 6. Extract metrics from lighthouseResult
    const audits     = psiData?.lighthouseResult?.audits || {};
    const categories = psiData?.lighthouseResult?.categories || {};

    const score = categories?.performance?.score != null
      ? Math.round(categories.performance.score * 100)
      : null;

    const lcp = audits['largest-contentful-paint']?.numericValue != null
      ? Math.round(audits['largest-contentful-paint'].numericValue)
      : null;

    const cls = audits['cumulative-layout-shift']?.numericValue != null
      ? Math.round(audits['cumulative-layout-shift'].numericValue * 1000) / 1000
      : null;

    const fid = audits['max-potential-fid']?.numericValue != null
      ? Math.round(audits['max-potential-fid'].numericValue)
      : null;

    const fcp = audits['first-contentful-paint']?.numericValue != null
      ? Math.round(audits['first-contentful-paint'].numericValue)
      : null;

    const ttfb = audits['server-response-time']?.numericValue != null
      ? Math.round(audits['server-response-time'].numericValue)
      : null;

    // 7. Return result
    return res.json({
      url,
      strategy,
      score,
      lcp,
      cls,
      fid,
      fcp,
      ttfb,
      analyzed_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[psi] Unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected error analyzing URL with PageSpeed Insights' });
  }
});

export default router;
