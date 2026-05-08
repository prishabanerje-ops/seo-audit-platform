// backend/services/crux.js
// CrUX (Chrome UX Report) API client — fetches field data for a given URL
import https from 'https';

const CRUX_API_URL = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

const METRIC_KEYS = ['largest_contentful_paint', 'first_input_delay', 'cumulative_layout_shift',
  'first_contentful_paint', 'interaction_to_next_paint', 'experimental_time_to_first_byte'];

/**
 * Fetch CrUX field data for a URL.
 * Returns null if the API key is missing, the URL has no data, or the request fails.
 * @param {string} url
 * @param {string} apiKey
 * @returns {Promise<object|null>}
 */
export async function fetchCruxData(url, apiKey) {
  if (!apiKey) return null;

  const body = JSON.stringify({ url, formFactor: 'PHONE', metrics: METRIC_KEYS });
  const apiUrl = `${CRUX_API_URL}?key=${encodeURIComponent(apiKey)}`;

  return new Promise((resolve) => {
    const urlObj = new URL(apiUrl);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error || !parsed.record) { resolve(null); return; }
          resolve(normalise(parsed.record));
        } catch { resolve(null); }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// CrUX thresholds (p75 field data)
const LCP_POOR_MS  = 4000;
const INP_POOR_MS  = 500;
const CLS_POOR     = 0.25;
const SECTION = 'Core Web Vitals';

/**
 * Section runner for CrUX field checks. Fetches CrUX data for each page.
 * Skips gracefully when no API key is configured.
 */
export async function runCruxChecks(records, ctx) {
  const failures = [];
  const apiKey = ctx.siteSettings?.get('crux_api_key') || '';
  if (!apiKey) return failures; // CrUX disabled — no API key

  for (const r of records) {
    const url = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;

    const data = await fetchCruxData(url, apiKey);
    if (!data) continue;
    const { metrics } = data;

    // crux_lcp
    const lcp = metrics?.largest_contentful_paint;
    if (lcp && lcp.p75 > LCP_POOR_MS) {
      failures.push({ check_id: 'crux_lcp', passed: false, severity: 'critical', section: SECTION,
        message: `Field LCP p75 = ${lcp.p75}ms — poor threshold is ${LCP_POOR_MS}ms`, details: url });
    }

    // crux_inp
    const inp = metrics?.interaction_to_next_paint;
    if (inp && inp.p75 > INP_POOR_MS) {
      failures.push({ check_id: 'crux_inp', passed: false, severity: 'critical', section: SECTION,
        message: `Field INP p75 = ${inp.p75}ms — poor threshold is ${INP_POOR_MS}ms`, details: url });
    }

    // crux_cls
    const cls = metrics?.cumulative_layout_shift;
    if (cls && cls.p75 > CLS_POOR) {
      failures.push({ check_id: 'crux_cls', passed: false, severity: 'warning', section: SECTION,
        message: `Field CLS p75 = ${cls.p75} — poor threshold is ${CLS_POOR}`, details: url });
    }
  }

  return failures;
}

function normalise(record) {
  const metrics = record.metrics || {};
  const out = {};

  for (const key of METRIC_KEYS) {
    const m = metrics[key];
    if (!m) continue;
    const p75 = m.percentiles?.p75;
    const histo = m.histogram || [];
    // good / needs improvement / poor buckets
    const [good, ni, poor] = histo.map(b => Math.round((b.density || 0) * 100));
    out[key] = { p75, good, needsImprovement: ni, poor };
  }

  return { url: record.key?.url, formFactor: record.key?.formFactor, metrics: out };
}
