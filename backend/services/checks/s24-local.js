// backend/services/checks/s24-local.js
const SECTION = 'Local SEO';
const LOCATION_URL_RE = /\/(location|city-|[a-z]+-[a-z]+-(city|branch|office|store))|\b[a-z]+\b\/(dubai|abu-dhabi|mumbai|delhi|london|new-york)/i;
const PHONE_TOLLFREE_RE = /1800[-\s]\d{3}[-\s]\d{4}|0800[-\s]\d+/;
const PHONE_LOCAL_RE    = /(\+91[-\s]?)?[6-9]\d{9}|0\d{2,4}[-\s]\d{6,8}|\+971[-\s]?\d{8,9}/;
const LOCAL_REQUIRED    = ['name', 'address', 'telephone', 'openingHours'];

export function runLocalChecks(records, _ctx) {
  const failures = [];

  for (const r of records) {
    const url   = r.url || '';
    if (!url) continue;
    const code  = String(r['Status Code'] || '');
    const isIdx = r['Indexability'] === 'Indexable';
    const schema = r._schemaTypes || [];
    const items  = r._schemaItems || [];

    // local_location_crawlable — location pages returning non-200 or noindex
    if (LOCATION_URL_RE.test(url) && ((code && !code.startsWith('200')) || !isIdx)) {
      failures.push({ check_id: 'local_location_crawlable', passed: false, severity: 'warning', section: SECTION,
        message: `Location page not crawlable/indexable (${code || 'noindex'})`, details: url });
    }

    if (!isIdx) continue;

    // local_business_schema — LocalBusiness schema required fields
    if (schema.includes('LocalBusiness')) {
      const item = items.find(i => i['Type'] === 'LocalBusiness');
      if (item) {
        const props = new Set((item.properties || []).map(p => p.name));
        const missing = LOCAL_REQUIRED.filter(f => !props.has(f));
        if (missing.length > 0) {
          failures.push({ check_id: 'local_business_schema', passed: false, severity: 'critical', section: SECTION,
            message: `LocalBusiness schema missing: ${missing.join(', ')}`, details: url });
        }

        // local_schema_geo — geo coordinates
        if (!props.has('geo')) {
          failures.push({ check_id: 'local_schema_geo', passed: false, severity: 'info', section: SECTION,
            message: 'LocalBusiness schema missing geo coordinates (latitude/longitude)', details: url });
        }
      }
    } else if (LOCATION_URL_RE.test(url)) {
      failures.push({ check_id: 'local_business_schema', passed: false, severity: 'critical', section: SECTION,
        message: 'Location page missing LocalBusiness schema', details: url });
    }

    // local_nap_consistency — compare schema NAP to visible footer NAP
    if (schema.includes('LocalBusiness') && r._visibleNap) {
      const item = items.find(i => i['Type'] === 'LocalBusiness');
      if (item) {
        const props = new Map((item.properties || []).map(p => [p.name, p.value]));
        const schemaName = (props.get('name') || '').toLowerCase();
        const visibleName = (r._visibleNap.name || '').toLowerCase();
        if (schemaName && visibleName && schemaName !== visibleName &&
            Math.abs(schemaName.length - visibleName.length) > 2) {
          failures.push({ check_id: 'local_nap_consistency', passed: false, severity: 'critical', section: SECTION,
            message: `Schema NAP name "${props.get('name')}" differs from visible "${r._visibleNap.name}"`,
            details: url });
        }
      }
    }

    // local_google_map_embedded — only flag when extractor explicitly found no embed
    const isContactPage = /\/(contact|location|branch|office|store)/i.test(url);
    if (isContactPage && r._hasGoogleMapEmbed === false) {
      failures.push({ check_id: 'local_google_map_embedded', passed: false, severity: 'info', section: SECTION,
        message: 'Location/contact page missing embedded Google Map', details: url });
    }

    // local_phone_number — only toll-free, no local number
    const body = r._bodyText || '';
    const hasTollFree = PHONE_TOLLFREE_RE.test(body);
    const hasLocal    = PHONE_LOCAL_RE.test(body);
    if (hasTollFree && !hasLocal && isContactPage) {
      failures.push({ check_id: 'local_phone_number', passed: false, severity: 'info', section: SECTION,
        message: 'Only toll-free number found — consider adding a local phone number', details: url });
    }
  }

  return failures;
}
