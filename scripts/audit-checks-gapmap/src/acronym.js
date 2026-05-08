const SEO_ACRONYMS = {
  lcp: 'largest contentful paint',
  cls: 'cumulative layout shift',
  fid: 'first input delay',
  inp: 'interaction to next paint',
  tbt: 'total blocking time',
  fcp: 'first contentful paint',
  ttfb: 'time to first byte',
  cwv: 'core web vitals',
  gsc: 'search console',
  ga4: 'analytics',
  psi: 'pagespeed insights',
  seo: 'search engine optimization',
};

export function splitCamelCase(s) {
  if (!s) return s;
  return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

export function expandAcronyms(s) {
  if (!s) return s;
  // Replace whole-word acronyms (case-insensitive) with their expansions
  return s.split(/\b/).map(token => {
    const lower = token.toLowerCase();
    return SEO_ACRONYMS[lower] || token;
  }).join('');
}
