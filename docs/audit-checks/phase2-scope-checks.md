# Phase 2 — Scope: 204 Active CSV-Derived Canonical Checks

These are the 204 canonical checks that Phase 2 will gap-map against the platform implementation.
Selection: `decision IN (keep, edit) AND source IN (csv-only, both)`.
Excluded from this phase: 95 cut rows, 32 merge rows (status follows merge target), 257 seed-only rows.

Severity legend: 🔴 critical · 🟡 warning · ⚪ info

## AI Overviews & AIO Optimization (12 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C263 | 🔴 | man | Passage-Level Clarity |
| C264 | 🔴 | man | Definition / Summary Paragraph |
| C265 | 🟡 | man | Question-Answer Format Content |
| C266 | 🔴 | man | Factual Accuracy and Verifiability |
| C268 | 🟡 | man | Content Freshness for AI |
| C270 | 🟡 | man | Authoritative Tone |
| C271 | 🟡 | man | Concise Answers Before Detail |
| C272 | ⚪ | auto | Long-Tail Question Coverage |
| C275 | ⚪ | auto | Table of Contents with Anchors |
| C276 | 🟡 | man | Featured Snippet Optimization |
| C277 | 🟡 | man | Entities and NLP Clarity |
| C280 | 🟡 | man | NLP-Friendly Content Structure |

## Canonicalisation (7 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C012 | 🔴 | auto | Duplicate Canonical Tags |
| C013 | 🔴 | auto | Canonical Points to HTTPS |
| C014 | 🔴 | auto | Canonical to 4xx or 5xx |
| C015 | 🔴 | auto | Canonical Loops |
| C016 | 🟡 | auto | Reciprocal Canonicals |
| C019 | ⚪ | auto | URL Parameter Handling |
| C020 | 🟡 | auto | Hreflang vs Canonical Conflict |

## Content Quality (8 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C139 | 🟡 | auto | Cornerstone Content Word Count |
| C140 | 🔴 | auto | Thin Content Detection |
| C141 | 🔴 | auto | Duplicate Content Internal |
| C142 | 🟡 | auto | Near-Duplicate Content |
| C144 | ⚪ | auto | Keyword Variations Used |
| C146 | 🟡 | man | Readability Score |
| C149 | 🟡 | man | Fact Checking |
| C152 | 🔴 | man | Content-Search Intent Match |

## Core Web Vitals (8 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C098 | 🔴 | auto | LCP (Largest Contentful Paint) |
| C099 | 🔴 | auto | INP (Interaction to Next Paint) |
| C100 | 🔴 | auto | CLS (Cumulative Layout Shift) |
| C101 | ⚪ | auto | FCP (First Contentful Paint) |
| C102 | ⚪ | auto | TTFB (Time to First Byte) |
| C104 | 🔴 | auto | CWV Pass Rate |
| C106 | 🟡 | man | CLS Causes |
| C107 | 🟡 | man | CWV Trend Over Time |

## Crawlability & Indexability (9 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C046 | 🔴 | auto | Meta Noindex Used Correctly |
| C047 | 🔴 | auto | X-Robots-Tag Header |
| C049 | 🟡 | auto | Orphan Pages |
| C050 | 🟡 | auto | Soft 404 Detection |
| C051 | 🔴 | auto | Session IDs in URLs |
| C052 | 🔴 | auto | Crawl Trap / Infinite Parameters |
| C053 | 🟡 | auto | URL Parameters Handled |
| C054 | 🟡 | auto | Nofollow Internal Links |
| C055 | ⚪ | auto | Noindex on Paginated Pages |

## E-E-A-T Signals (11 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C241 | 🔴 | man | Author Expertise Visible |
| C242 | 🟡 | man | Author Links to Social/Profile |
| C243 | 🟡 | hyb | About Page Quality |
| C244 | 🟡 | hyb | Contact Page Present |
| C245 | 🟡 | hyb | Physical Address / Location |
| C250 | 🟡 | man | Expert Review of Content |
| C252 | 🟡 | hyb | Privacy Policy Present |
| C254 | 🟡 | hyb | Secure Payment Signals |
| C257 | 🟡 | man | Positive Brand Sentiment |
| C259 | ⚪ | auto | Structured Data for Organization |
| C261 | 🔴 | man | YMYL Content Medical/Financial Review |

## GEO & LLM Crawlers (11 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C282 | ⚪ | auto | LLMs.txt File Present |
| C283 | 🟡 | auto | AI Bot Access in Robots.txt |
| C284 | ⚪ | auto | Google-Extended Directive |
| C285 | 🔴 | auto | Content Available Without JS for AI |
| C286 | 🟡 | man | Topical Authority Signals for AI |
| C289 | ⚪ | auto | Crawlable Pagination |
| C290 | 🟡 | auto | Structured FAQs Accessible to AI |
| C291 | 🟡 | auto | Canonical URL for AI Deduplication |
| C292 | ⚪ | auto | Open Graph Tags for Social AI |
| C293 | 🟡 | man | Content Depth on Single URL |
| C294 | 🔴 | auto | HTTPS for AI Crawler Trust |

## Headings (8 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C128 | 🔴 | auto | H1 Present |
| C129 | 🔴 | auto | H1 Unique Across Site |
| C130 | 🟡 | auto | H1 Content Relevance |
| C131 | ⚪ | auto | H1 Length |
| C132 | 🟡 | auto | H2 Structure |
| C134 | 🟡 | auto | H3-H6 Nesting Order |
| C136 | ⚪ | auto | Keyword in H2s |
| C137 | 🟡 | auto | Keyword Stuffing in Headings |

## Images (11 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C153 | 🔴 | auto | Alt Text Present |
| C155 | ⚪ | auto | Decorative Image Handling |
| C156 | ⚪ | auto | Image File Name |
| C157 | ⚪ | auto | Image File Format |
| C158 | 🟡 | auto | Image File Size |
| C159 | ⚪ | auto | Image Dimensions Declared |
| C160 | ⚪ | auto | Lazy Loading |
| C161 | ⚪ | auto | Responsive Images Srcset |
| C162 | 🟡 | auto | Image Compression Quality |
| C163 | ⚪ | auto | Width-Height Aspect Ratio |
| C166 | ⚪ | auto | Next-Gen Format Adoption |

## Internal Linking (7 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C183 | 🔴 | auto | Internal Links Return 200 |
| C184 | 🟡 | auto | No Orphan Pages |
| C185 | 🟡 | auto | Internal Link Count per Page |
| C186 | 🟡 | auto | Crawl Depth |
| C188 | ⚪ | auto | Exact Match Anchor Overuse |
| C189 | 🟡 | auto | Nofollow on Internal Links |
| C192 | 🟡 | auto | Redirect Internal Links |

## International SEO (7 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C193 | 🔴 | auto | Hreflang Tags Present |
| C194 | 🔴 | auto | Hreflang Self-Reference |
| C195 | 🔴 | auto | Hreflang Reciprocal |
| C197 | 🟡 | auto | Hreflang Language Code Validity |
| C198 | 🔴 | auto | Hreflang URL Consistency |
| C199 | 🟡 | auto | Alternate Language Pages Indexed |
| C200 | 🔴 | man | Content Language Match |

## JavaScript Rendering (6 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C066 | 🔴 | auto | Critical Content in Raw HTML |
| C067 | 🔴 | auto | Metadata in Raw HTML |
| C068 | 🔴 | auto | Link Discovery via JS |
| C069 | 🟡 | auto | Structured Data Rendering |
| C070 | 🟡 | man | Render Comparison |
| C075 | 🟡 | man | Crawl Budget vs Rendering Time |

## Local SEO (14 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C297 | 🔴 | man | Google Business Profile Exists |
| C298 | 🔴 | man | GBP Category Accuracy |
| C299 | 🔴 | man | NAP Consistency (Name/Address/Phone) |
| C300 | 🔴 | auto | LocalBusiness Schema on Website |
| C301 | 🟡 | man | GBP Reviews (Volume) |
| C302 | 🔴 | man | GBP Reviews (Rating) |
| C303 | 🟡 | man | Review Response Rate |
| C307 | 🟡 | man | Citation Count |
| C309 | 🟡 | man | Location Page Quality |
| C310 | 🟡 | auto | Location Page Crawlable |
| C315 | 🟡 | man | Opening Hours Accuracy |
| C317 | 🟡 | man | Local Backlinks |
| C319 | 🟡 | man | Geo-Modified Keywords on Page |
| C320 | ⚪ | auto | Schema Geo Coordinates |

## Meta Descriptions (7 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C118 | 🟡 | auto | Meta Description Present |
| C122 | ⚪ | auto | Call-to-Action in Description |
| C123 | 🟡 | auto | Description Accuracy |
| C124 | ⚪ | auto | Keyword Position in Description |
| C125 | ⚪ | auto | No HTML Tags in Description |
| C126 | ⚪ | auto | Special Character Encoding |
| C127 | 🔴 | auto | Duplicate Auto-Generated Descriptions |

## Mobile & Usability (8 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C077 | 🔴 | auto | Mobile Responsiveness |
| C078 | 🟡 | auto | Tap Target Size |
| C079 | 🟡 | auto | Text Size Legibility |
| C080 | 🔴 | auto | Horizontal Scroll |
| C081 | 🟡 | auto | Zoom Disabled |
| C082 | 🟡 | auto | Interstitials on Mobile |
| C084 | 🟡 | auto | Touch Spacing |
| C085 | 🔴 | auto | Mobile Speed |

## Rankings & Traffic (7 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C203 | 🔴 | man | Google Search Console Connected |
| C204 | 🔴 | man | GA4 Connected |
| C206 | 🟡 | man | Organic Traffic Trend |
| C207 | 🟡 | man | Click-Through Rate (CTR) |
| C210 | 🟡 | man | Crawl Coverage in GSC |
| C211 | 🟡 | man | Core Update Impact Detection |
| C212 | 🟡 | man | Cannibalization Detection |

## Response Codes & Redirects (8 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C001 | 🔴 | auto | 200 Status Code |
| C002 | 🟡 | auto | 301 vs 302 Usage |
| C005 | 🔴 | auto | Redirect to HTTPS |
| C006 | 🔴 | auto | 4xx Broken Pages |
| C007 | 🔴 | auto | 5xx Server Errors |
| C008 | 🟡 | auto | Temporary Redirect Overuse |
| C009 | ⚪ | auto | Redirect Count |
| C010 | ⚪ | auto | Gone vs Not Found |

## Robots & Crawl Directives (10 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C021 | 🔴 | auto | Robots.txt Exists |
| C022 | 🟡 | auto | Robots.txt Valid Syntax |
| C023 | ⚪ | auto | Sitemap Declared in Robots.txt |
| C024 | 🔴 | auto | Crawlable Resources Not Blocked |
| C025 | 🟡 | auto | Sensitive Paths Blocked |
| C026 | 🔴 | auto | Important Pages Not Blocked |
| C027 | 🟡 | auto | Conflicting Directives |
| C028 | ⚪ | auto | AI Crawler Directives |
| C029 | 🟡 | auto | Meta Noindex Not Contradicting Disallow |
| C030 | ⚪ | auto | Crawl-Delay Set If Needed |

## Schema & Structured Data (9 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C167 | 🔴 | auto | Schema Markup Present |
| C168 | 🟡 | auto | JSON-LD Format Used |
| C169 | 🟡 | auto | Schema Validation (Schema.org) |
| C170 | 🟡 | auto | Google Rich Results Eligibility |
| C171 | ⚪ | auto | Article Schema |
| C173 | ⚪ | auto | Product Schema |
| C174 | ⚪ | auto | Review / Rating Schema |
| C176 | ⚪ | auto | Breadcrumb Schema |
| C178 | ⚪ | auto | Video Schema |

## Security & HTTPS (11 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C087 | 🔴 | auto | HTTPS Enabled |
| C088 | 🔴 | auto | SSL Certificate Valid |
| C089 | 🔴 | auto | SSL Certificate Chain Complete |
| C090 | 🟡 | auto | HSTS Header |
| C091 | 🟡 | auto | Content Security Policy |
| C092 | 🟡 | auto | X-Frame-Options |
| C093 | 🟡 | auto | X-Content-Type-Options |
| C094 | ⚪ | auto | Referrer-Policy |
| C095 | 🔴 | auto | Mixed Content |
| C096 | 🟡 | auto | Security Headers Grade |
| C097 | ⚪ | auto | Permissions-Policy |

## Title Tags (6 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C108 | 🔴 | auto | Title Tag Present |
| C111 | 🟡 | auto | Title Tag Pixel Width |
| C113 | 🟡 | auto | Keyword Position in Title |
| C114 | ⚪ | auto | Brand in Title |
| C116 | 🟡 | auto | Title Relevance to Content |
| C117 | ⚪ | auto | Title vs H1 Differentiation |

## URL Structure (9 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C056 | ⚪ | auto | URL Length |
| C057 | 🟡 | auto | Lowercase Characters |
| C058 | 🟡 | auto | Hyphen Word Separators |
| C059 | 🟡 | auto | Special Characters in Slug |
| C060 | ⚪ | auto | Keyword in URL |
| C061 | ⚪ | auto | Descriptive URL Slugs |
| C062 | 🟡 | auto | Trailing Slash Consistency |
| C063 | 🟡 | auto | Deep Nesting |
| C065 | ⚪ | auto | Date Format in URLs |

## XML Sitemaps (10 checks)

| check_id | sev | auto | name |
|---|---|---|---|
| C033 | 🔴 | auto | Sitemap URL Count |
| C034 | 🔴 | auto | Sitemap File Size |
| C035 | ⚪ | auto | Sitemap Index Used for Large Sites |
| C036 | ⚪ | auto | Sitemap Declared in Robots.txt |
| C038 | 🟡 | auto | No 4xx/5xx URLs in Sitemap |
| C039 | 🟡 | auto | No Redirect URLs in Sitemap |
| C040 | ⚪ | auto | Orphan URLs in Sitemap |
| C041 | ⚪ | auto | Lastmod Accuracy |
| C042 | ⚪ | auto | Image Sitemap |
| C043 | ⚪ | auto | Video Sitemap |

