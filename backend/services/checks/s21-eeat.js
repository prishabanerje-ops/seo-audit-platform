// backend/services/checks/s21-eeat.js
import { classifyYmyl } from '../audit-parser.service.js';
const SECTION_EEAT = 'E-E-A-T Signals';

const IRDAI_RE    = /IRDA[I]?\s*Reg\.?\s*No\.?\s*\d+/i;
const SEBI_RE     = /SEBI\s*Reg\.?\s*No/i;
const DISCLAIMER_PATTERNS = [
  /insurance is subject to terms/i,
  /read policy document carefully/i,
  /licensed broker/i,
  /not financial advice/i,
  /consult a financial advisor/i,
];
const CREDENTIAL_RE = /\b(CFP|CFA|CAIIB|Dr\.|MBBS|CA\b|LLB|IRDAI licensed|SEBI registered)\b/;
const EXPERT_REVIEW_RE = /reviewed by|medically reviewed|fact.?checked by|verified by|approved by/i;
const DATE_RE = /last updated|reviewed on|effective from|as of [a-z]+ \d{4}/i;
const TRUSTED_GOV_RE  = /\.(gov|edu)(\.|\b)/i;

export function runEeatChecks(records, ctx) {
  const failures = [];

  // Site-level: contact/privacy/terms links
  const allLinks = records.flatMap(r => r._internalLinks || []);
  const hasContactLink = allLinks.some(l => /\/(contact|contact-us|reach-us)/i.test(l.href || ''));
  const hasPrivacyLink = allLinks.some(l => /\/(privacy|privacy-policy)/i.test(l.href || ''));
  const hasTermsLink   = allLinks.some(l => /\/(terms|terms-of-service|tos)/i.test(l.href || ''));

  if (!hasContactLink) {
    failures.push({ check_id: 'contact_page_present', passed: false, severity: 'warning', section: SECTION_EEAT,
      message: 'No link to contact page found in site navigation', details: null });
  }

  const customYmylPatterns = (ctx.siteSettings?.get('ymyl_url_patterns') || '').split('\n').filter(Boolean);

  for (const r of records) {
    const url   = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const body    = r._bodyText || '';
    const words   = parseInt(r['Word Count'] || '0', 10);
    const ymyl    = classifyYmyl(url, body, customYmylPatterns);
    const isYmyl  = ymyl !== null;
    const schema  = r._schemaTypes || [];
    const items   = r._schemaItems || [];
    const links   = r._internalLinks || [];

    // author_expertise — only flag when _authorSignal is explicitly false
    if (words > 300 && r._authorSignal === false) {
      failures.push({
        check_id: 'author_expertise', passed: false,
        severity: isYmyl ? 'critical' : 'warning',
        section: SECTION_EEAT,
        message: `No author attribution found on ${isYmyl ? 'YMYL ' : ''}content page`,
        details: url });
    }

    // author_links — author block without social/profile links
    if (r._authorSignal && r._authorHasSocialLink === false) {
      failures.push({ check_id: 'author_links', passed: false, severity: 'warning', section: SECTION_EEAT,
        message: 'Author block found but no social/profile links (LinkedIn, Twitter, etc.)', details: url });
    }

    // expert_review — only flag when explicitly false or body long enough to check
    if (words > 300 && body.length > 200 && !EXPERT_REVIEW_RE.test(body)) {
      failures.push({
        check_id: 'expert_review', passed: false,
        severity: isYmyl ? 'critical' : 'warning',
        section: SECTION_EEAT,
        message: `No expert review/fact-check attribution on ${isYmyl ? 'YMYL ' : ''}content page`,
        details: url });
    }

    // ymyl_disclaimer_present
    if (isYmyl) {
      const customDisclaimerPatterns = (ctx.siteSettings?.get('ymyl_disclaimer_patterns') || '')
        .split('\n').filter(Boolean).map(p => { try { return new RegExp(p, 'i'); } catch { return null; } }).filter(Boolean);
      const allPatterns = [...DISCLAIMER_PATTERNS, IRDAI_RE, SEBI_RE, ...customDisclaimerPatterns];
      const hasDisclaimer = allPatterns.some(re => re.test(body));
      if (!hasDisclaimer) {
        failures.push({ check_id: 'ymyl_disclaimer_present', passed: false, severity: 'critical', section: SECTION_EEAT,
          message: 'YMYL page missing regulatory disclaimer (IRDAI/SEBI or financial advisory notice)',
          details: url });
      }
    }

    // ymyl_date_disclosure
    if (isYmyl) {
      const hasDate = DATE_RE.test(body) || r['article:modified_time'] || r['article:published_time'];
      if (!hasDate) {
        failures.push({ check_id: 'ymyl_date_disclosure', passed: false, severity: 'critical', section: SECTION_EEAT,
          message: 'YMYL page has no visible date disclosure (last updated / reviewed on)', details: url });
      }
    }

    // ymyl_outbound_authority
    if (isYmyl && words >= 200) {
      const outboundLinks = links.filter(l => {
        try { return new URL(l.href).hostname !== new URL(url).hostname; } catch { return false; }
      });
      const trustedDomains = (ctx.siteSettings?.get('trusted_authority_domains') || '')
        .split('\n').filter(Boolean);
      const hasAuthority = outboundLinks.some(l => {
        try {
          const host = new URL(l.href).hostname;
          return TRUSTED_GOV_RE.test(host) || trustedDomains.some(d => host === d || host.endsWith('.' + d));
        } catch { return false; }
      });
      if (!hasAuthority) {
        failures.push({ check_id: 'ymyl_outbound_authority', passed: false, severity: 'info', section: SECTION_EEAT,
          message: 'YMYL page has no outbound links to government or authoritative domains', details: url });
      }
    }

    // author_credentials_schema
    if (schema.some(t => ['Article','BlogPosting','NewsArticle'].includes(t))) {
      for (const item of items) {
        if (!['Article','BlogPosting','NewsArticle'].includes(item['Type'])) continue;
        const author = item['author'] || {};
        if (author.name && !author.jobTitle && !author.honorificPrefix) {
          failures.push({
            check_id: 'author_credentials_schema', passed: false,
            severity: isYmyl ? 'critical' : 'warning',
            section: SECTION_EEAT,
            message: 'Article author schema missing jobTitle or honorificPrefix credential',
            details: url });
        }
      }
    }

    // ymyl_review — YMYL page needs expert reviewer with credentials
    if (isYmyl && words > 300) {
      const credentialMatch = EXPERT_REVIEW_RE.test(body) && CREDENTIAL_RE.test(body);
      if (!credentialMatch) {
        failures.push({ check_id: 'ymyl_review', passed: false, severity: 'critical', section: SECTION_EEAT,
          message: 'YMYL page missing expert reviewer credit with recognized credentials', details: url });
      }
    }

    // update_history_visible
    if (!DATE_RE.test(body) && !r._hasTimeElement) {
      failures.push({ check_id: 'update_history_visible', passed: false, severity: 'info', section: SECTION_EEAT,
        message: 'No "Last updated" date element visible on page', details: url });
    }

    // transparent_methodology
    if (r._hasDataSignals && !/(methodology|how we calculate|how we rank|data source|based on data from|our research process)/i.test(body)) {
      failures.push({ check_id: 'transparent_methodology', passed: false, severity: 'info', section: SECTION_EEAT,
        message: 'Data-heavy page has no methodology disclosure', details: url });
    }
  }

  return failures;
}
