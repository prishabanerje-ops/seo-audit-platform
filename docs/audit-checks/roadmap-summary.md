# Audit-Checks Roadmap v1

- Generated: 2026-04-27T06:19:32.124Z
- Label: R7 finalized
- Total in-scope: 163 (149 missing + 14 partial)

## By priority
- P0: 54
- P1: 61
- P2: 48

## By effort
- S: 14
- M: 65
- L: 84
- XL: 0

## Priority × category crosstab
| Category | P0 | P1 | P2 | Total |
|---|---|---|---|---|
| Security & HTTPS | 4 | 5 | 2 | 11 |
| Crawlability & Indexability | 5 | 3 | 1 | 9 |
| Mobile & Usability | 3 | 5 | 0 | 8 |
| Robots & Crawl Directives | 3 | 4 | 3 | 10 |
| Response Codes & Redirects | 3 | 3 | 1 | 7 |
| Canonicalisation | 4 | 2 | 1 | 7 |
| Headings | 3 | 3 | 2 | 8 |
| Internal Linking | 3 | 3 | 1 | 7 |
| International SEO | 4 | 2 | 0 | 6 |
| URL Structure | 0 | 5 | 2 | 7 |
| JavaScript Rendering | 3 | 2 | 0 | 5 |
| E-E-A-T Signals | 0 | 5 | 1 | 6 |
| GEO & LLM Crawlers | 2 | 3 | 4 | 9 |
| XML Sitemaps | 2 | 2 | 6 | 10 |
| Core Web Vitals | 4 | 0 | 2 | 6 |
| Title Tags | 1 | 3 | 2 | 6 |
| Content Quality | 3 | 1 | 1 | 5 |
| Images | 1 | 3 | 7 | 11 |
| Schema & Structured Data | 1 | 3 | 5 | 9 |
| Local SEO | 3 | 1 | 1 | 5 |
| Meta Descriptions | 1 | 2 | 4 | 7 |
| Rankings & Traffic | 1 | 1 | 0 | 2 |
| AI Overviews & AIO Optimization | 0 | 0 | 2 | 2 |

## P0 backlog (the build-first list)

### Canonicalisation
- C012: Duplicate Canonical Tags [critical, missing, M] — R-BASE-CRITICAL (critical→P0)
- C013: Canonical Points to HTTPS [critical, missing, M] — R-BASE-CRITICAL (critical→P0)
- C014: Canonical to 4xx or 5xx [critical, missing, M] — R-BASE-CRITICAL (critical→P0)
- C015: Canonical Loops [critical, missing, M] — R-BASE-CRITICAL (critical→P0)

### Content Quality
- C139: Cornerstone Content Word Count [warning, partial, S] — R-PROMO-PARTIAL (partial+warning→P0)
- C140: Thin Content Detection [critical, partial, S] — R-PROMO-PARTIAL (partial+critical→P0)
- C141: Duplicate Content Internal [critical, missing, M] — R-BASE-CRITICAL (critical→P0)

### Core Web Vitals
- C098: LCP (Largest Contentful Paint) [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C099: INP (Interaction to Next Paint) [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C100: CLS (Cumulative Layout Shift) [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C104: CWV Pass Rate [critical, missing, L] — R-BASE-CRITICAL (critical→P0)

### Crawlability & Indexability
- C046: Meta Noindex Used Correctly [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C047: X-Robots-Tag Header [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C051: Session IDs in URLs [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C052: Crawl Trap / Infinite Parameters [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C054: Nofollow Internal Links [warning, partial, S] — R-PROMO-PARTIAL (partial+warning→P0)

### GEO & LLM Crawlers
- C285: Content Available Without JS for AI [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C294: HTTPS for AI Crawler Trust [critical, missing, L] — R-BASE-CRITICAL (critical→P0)

### Headings
- C128: H1 Present [critical, missing, M] — R-BASE-CRITICAL (critical→P0)
- C129: H1 Unique Across Site [critical, missing, M] — R-BASE-CRITICAL (critical→P0)
- C137: Keyword Stuffing in Headings [warning, partial, S] — R-PROMO-PARTIAL (partial+warning→P0)

### Images
- C153: Alt Text Present [critical, missing, M] — R-BASE-CRITICAL (critical→P0)

### Internal Linking
- C183: Internal Links Return 200 [critical, partial, S] — R-PROMO-PARTIAL (partial+critical→P0)
- C189: Nofollow on Internal Links [warning, partial, S] — R-PROMO-PARTIAL (partial+warning→P0)
- C192: Redirect Internal Links [warning, partial, S] — R-PROMO-PARTIAL (partial+warning→P0)

### International SEO
- C193: Hreflang Tags Present [critical, partial, S] — R-PROMO-PARTIAL (partial+critical→P0)
- C194: Hreflang Self-Reference [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C195: Hreflang Reciprocal [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C198: Hreflang URL Consistency [critical, missing, L] — R-BASE-CRITICAL (critical→P0)

### JavaScript Rendering
- C066: Critical Content in Raw HTML [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C067: Metadata in Raw HTML [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C068: Link Discovery via JS [critical, missing, L] — R-BASE-CRITICAL (critical→P0)

### Local SEO
- C298: GBP Category Accuracy [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C300: LocalBusiness Schema on Website [critical, partial, S] — R-PROMO-PARTIAL (partial+critical→P0)
- C307: Citation Count [warning, partial, S] — R-PROMO-PARTIAL (partial+warning→P0)

### Meta Descriptions
- C127: Duplicate Auto-Generated Descriptions [critical, missing, M] — R-BASE-CRITICAL (critical→P0)

### Mobile & Usability
- C077: Mobile Responsiveness [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C080: Horizontal Scroll [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C085: Mobile Speed [critical, missing, L] — R-BASE-CRITICAL (critical→P0)

### Rankings & Traffic
- C203: Google Search Console Connected [critical, missing, L] — R-BASE-CRITICAL (critical→P0)

### Response Codes & Redirects
- C001: 200 Status Code [critical, missing, M] — R-BASE-CRITICAL (critical→P0)
- C005: Redirect to HTTPS [critical, partial, S] — R-PROMO-PARTIAL (partial+critical→P0)
- C006: 4xx Broken Pages [critical, missing, M] — R-BASE-CRITICAL (critical→P0)

### Robots & Crawl Directives
- C021: Robots.txt Exists [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C024: Crawlable Resources Not Blocked [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C026: Important Pages Not Blocked [critical, missing, L] — R-BASE-CRITICAL (critical→P0)

### Schema & Structured Data
- C167: Schema Markup Present [critical, missing, M] — R-BASE-CRITICAL (critical→P0)

### Security & HTTPS
- C087: HTTPS Enabled [critical, partial, S] — R-PROMO-PARTIAL (partial+critical→P0)
- C088: SSL Certificate Valid [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C089: SSL Certificate Chain Complete [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C095: Mixed Content [critical, missing, L] — R-BASE-CRITICAL (critical→P0)

### Title Tags
- C108: Title Tag Present [critical, missing, M] — R-BASE-CRITICAL (critical→P0)

### XML Sitemaps
- C033: Sitemap URL Count [critical, missing, L] — R-BASE-CRITICAL (critical→P0)
- C034: Sitemap File Size [critical, missing, L] — R-BASE-CRITICAL (critical→P0)

## P1 backlog

### Canonicalisation
- C016: Reciprocal Canonicals [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C020: Hreflang vs Canonical Conflict [warning, missing, M] — R-BASE-WARNING (warning→P1)

### Content Quality
- C142: Near-Duplicate Content [warning, missing, M] — R-BASE-WARNING (warning→P1)

### Crawlability & Indexability
- C049: Orphan Pages [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C050: Soft 404 Detection [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C053: URL Parameters Handled [warning, missing, L] — R-BASE-WARNING (warning→P1)

### E-E-A-T Signals
- C243: About Page Quality [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C244: Contact Page Present [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C245: Physical Address / Location [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C252: Privacy Policy Present [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C254: Secure Payment Signals [warning, missing, L] — R-BASE-WARNING (warning→P1)

### GEO & LLM Crawlers
- C283: AI Bot Access in Robots.txt [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C290: Structured FAQs Accessible to AI [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C291: Canonical URL for AI Deduplication [warning, missing, L] — R-BASE-WARNING (warning→P1)

### Headings
- C130: H1 Content Relevance [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C132: H2 Structure [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C134: H3-H6 Nesting Order [warning, missing, M] — R-BASE-WARNING (warning→P1)

### Images
- C158: Image File Size [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C160: Lazy Loading [info, partial, S] — R-PROMO-PARTIAL (partial+info→P1)
- C162: Image Compression Quality [warning, missing, M] — R-BASE-WARNING (warning→P1)

### Internal Linking
- C184: No Orphan Pages [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C185: Internal Link Count per Page [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C186: Crawl Depth [warning, missing, M] — R-BASE-WARNING (warning→P1)

### International SEO
- C197: Hreflang Language Code Validity [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C199: Alternate Language Pages Indexed [warning, missing, L] — R-BASE-WARNING (warning→P1)

### JavaScript Rendering
- C069: Structured Data Rendering [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C070: Render Comparison [warning, missing, L] — R-BASE-WARNING (warning→P1)

### Local SEO
- C310: Location Page Crawlable [warning, missing, L] — R-BASE-WARNING (warning→P1)

### Meta Descriptions
- C118: Meta Description Present [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C123: Description Accuracy [warning, missing, M] — R-BASE-WARNING (warning→P1)

### Mobile & Usability
- C078: Tap Target Size [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C079: Text Size Legibility [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C081: Zoom Disabled [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C082: Interstitials on Mobile [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C084: Touch Spacing [warning, missing, L] — R-BASE-WARNING (warning→P1)

### Rankings & Traffic
- C210: Crawl Coverage in GSC [warning, missing, L] — R-BASE-WARNING (warning→P1)

### Response Codes & Redirects
- C002: 301 vs 302 Usage [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C008: Temporary Redirect Overuse [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C009: Redirect Count [info, partial, S] — R-PROMO-PARTIAL (partial+info→P1)

### Robots & Crawl Directives
- C022: Robots.txt Valid Syntax [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C025: Sensitive Paths Blocked [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C027: Conflicting Directives [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C029: Meta Noindex Not Contradicting Disallow [warning, missing, L] — R-BASE-WARNING (warning→P1)

### Schema & Structured Data
- C168: JSON-LD Format Used [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C169: Schema Validation (Schema.org) [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C170: Google Rich Results Eligibility [warning, missing, M] — R-BASE-WARNING (warning→P1)

### Security & HTTPS
- C090: HSTS Header [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C091: Content Security Policy [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C092: X-Frame-Options [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C093: X-Content-Type-Options [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C096: Security Headers Grade [warning, missing, L] — R-BASE-WARNING (warning→P1)

### Title Tags
- C111: Title Tag Pixel Width [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C113: Keyword Position in Title [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C116: Title Relevance to Content [warning, missing, M] — R-BASE-WARNING (warning→P1)

### URL Structure
- C057: Lowercase Characters [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C058: Hyphen Word Separators [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C059: Special Characters in Slug [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C062: Trailing Slash Consistency [warning, missing, M] — R-BASE-WARNING (warning→P1)
- C063: Deep Nesting [warning, missing, M] — R-BASE-WARNING (warning→P1)

### XML Sitemaps
- C038: No 4xx/5xx URLs in Sitemap [warning, missing, L] — R-BASE-WARNING (warning→P1)
- C039: No Redirect URLs in Sitemap [warning, missing, L] — R-BASE-WARNING (warning→P1)

## P2 backlog

### AI Overviews & AIO Optimization
- C272: Long-Tail Question Coverage [info, missing, L] — R-BASE-INFO (info→P2)
- C275: Table of Contents with Anchors [info, missing, L] — R-BASE-INFO (info→P2)

### Canonicalisation
- C019: URL Parameter Handling [info, missing, M] — R-BASE-INFO (info→P2)

### Content Quality
- C144: Keyword Variations Used [info, missing, M] — R-BASE-INFO (info→P2)

### Core Web Vitals
- C101: FCP (First Contentful Paint) [info, missing, L] — R-BASE-INFO (info→P2)
- C102: TTFB (Time to First Byte) [info, missing, L] — R-BASE-INFO (info→P2)

### Crawlability & Indexability
- C055: Noindex on Paginated Pages [info, missing, L] — R-BASE-INFO (info→P2)

### E-E-A-T Signals
- C259: Structured Data for Organization [info, missing, L] — R-BASE-INFO (info→P2)

### GEO & LLM Crawlers
- C282: LLMs.txt File Present [info, missing, L] — R-BASE-INFO (info→P2)
- C284: Google-Extended Directive [info, missing, L] — R-BASE-INFO (info→P2)
- C289: Crawlable Pagination [info, missing, L] — R-BASE-INFO (info→P2)
- C292: Open Graph Tags for Social AI [info, missing, L] — R-BASE-INFO (info→P2)

### Headings
- C131: H1 Length [info, missing, M] — R-BASE-INFO (info→P2)
- C136: Keyword in H2s [info, missing, M] — R-BASE-INFO (info→P2)

### Images
- C155: Decorative Image Handling [info, missing, M] — R-BASE-INFO (info→P2)
- C156: Image File Name [info, missing, M] — R-BASE-INFO (info→P2)
- C157: Image File Format [info, missing, M] — R-BASE-INFO (info→P2)
- C159: Image Dimensions Declared [info, missing, M] — R-BASE-INFO (info→P2)
- C161: Responsive Images Srcset [info, missing, M] — R-BASE-INFO (info→P2)
- C163: Width-Height Aspect Ratio [info, missing, M] — R-BASE-INFO (info→P2)
- C166: Next-Gen Format Adoption [info, missing, M] — R-BASE-INFO (info→P2)

### Internal Linking
- C188: Exact Match Anchor Overuse [info, missing, M] — R-BASE-INFO (info→P2)

### Local SEO
- C320: Schema Geo Coordinates [info, missing, L] — R-BASE-INFO (info→P2)

### Meta Descriptions
- C122: Call-to-Action in Description [info, missing, M] — R-BASE-INFO (info→P2)
- C124: Keyword Position in Description [info, missing, M] — R-BASE-INFO (info→P2)
- C125: No HTML Tags in Description [info, missing, M] — R-BASE-INFO (info→P2)
- C126: Special Character Encoding [info, missing, M] — R-BASE-INFO (info→P2)

### Response Codes & Redirects
- C010: Gone vs Not Found [info, missing, M] — R-BASE-INFO (info→P2)

### Robots & Crawl Directives
- C023: Sitemap Declared in Robots.txt [info, missing, L] — R-BASE-INFO (info→P2)
- C028: AI Crawler Directives [info, missing, L] — R-BASE-INFO (info→P2)
- C030: Crawl-Delay Set If Needed [info, missing, L] — R-BASE-INFO (info→P2)

### Schema & Structured Data
- C171: Article Schema [info, missing, M] — R-BASE-INFO (info→P2)
- C173: Product Schema [info, missing, M] — R-BASE-INFO (info→P2)
- C174: Review / Rating Schema [info, missing, M] — R-BASE-INFO (info→P2)
- C176: Breadcrumb Schema [info, missing, M] — R-BASE-INFO (info→P2)
- C178: Video Schema [info, missing, M] — R-BASE-INFO (info→P2)

### Security & HTTPS
- C094: Referrer-Policy [info, missing, L] — R-BASE-INFO (info→P2)
- C097: Permissions-Policy [info, missing, L] — R-BASE-INFO (info→P2)

### Title Tags
- C114: Brand in Title [info, missing, M] — R-BASE-INFO (info→P2)
- C117: Title vs H1 Differentiation [info, missing, M] — R-BASE-INFO (info→P2)

### URL Structure
- C061: Descriptive URL Slugs [info, missing, M] — R-BASE-INFO (info→P2)
- C065: Date Format in URLs [info, missing, M] — R-BASE-INFO (info→P2)

### XML Sitemaps
- C035: Sitemap Index Used for Large Sites [info, missing, L] — R-BASE-INFO (info→P2)
- C036: Sitemap Declared in Robots.txt [info, missing, L] — R-BASE-INFO (info→P2)
- C040: Orphan URLs in Sitemap [info, missing, L] — R-BASE-INFO (info→P2)
- C041: Lastmod Accuracy [info, missing, L] — R-BASE-INFO (info→P2)
- C042: Image Sitemap [info, missing, L] — R-BASE-INFO (info→P2)
- C043: Video Sitemap [info, missing, L] — R-BASE-INFO (info→P2)

## Decision log (individual triage answers)

# Roadmap Individual Triage

For each item, edit the `Your call:` line in place. Allowed values:
`P0` / `P1` / `P2` (re-priority); `effort: S` / `effort: M` / `effort: L` / `effort: XL` (re-effort);
combined like `P0 effort: L`; or `comment: <free text>` to append a note without changing priority/effort.

_No items flagged for individual review._