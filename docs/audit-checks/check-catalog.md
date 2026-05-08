# Check Catalog — SEO Audit Platform v2

**Source documents:**
- `audit-replan-subchecks-comprehensive.csv` — 321 checks across 24 categories
- `SEO Automation/docs/superpowers/specs/check-catalog.md` — auditai v1.1 (AI checks + JS SEO reclassifications)

This file is the canonical reference for every check in the platform. Implementation of any check must match the `check_id`, `severity`, and `notes` here exactly.

---

## Feasibility Key

| Symbol | Meaning |
|---|---|
| ✅ | Automated — Playwright crawler + HTTP, no external dependency |
| ⚠️ GSC | Requires Google Search Console OAuth connected for this site |
| ⚠️ GA4 | Requires Google Analytics 4 OAuth connected for this site |
| ⚠️ PSI | Requires PageSpeed Insights API key set in settings |
| ⚠️ CrUX | Requires Chrome UX Report API key set in settings |
| ⚠️ KW-UPLOAD | Requires keyword mapping CSV uploaded for this site |
| ⚠️ BL-UPLOAD | Requires backlink export CSV uploaded (Semrush/Ahrefs) or manual link entries |
| 🤖 | AI check — Claude API, on-demand only, never auto-runs during crawl |
| 📋 | Manual — human review required; clear pass/fail criteria, no auto-score |

**Platform integrations already present:**
- GSC: OAuth via `/api/gsc` — data in `gsc_cache` table
- PSI: API key in settings — existing `psi.js` route
- GA4: OAuth via `/api/ga4`
- Claude: `ai.service.js` with SSE streaming

**New integrations required:**
- CrUX: Chrome UX Report API (separate from PSI — requires `CRUX_API_KEY` in settings)
- Keyword upload: `keyword_mappings` table, CSV upload route
- Backlink upload: `backlinks` table, CSV upload route + manual-add form

---

## Summary

| Feasibility | Count |
|---|---|
| ✅ Automated | 216 |
| ⚠️ GSC | 13 |
| ⚠️ GA4 | 1 |
| ⚠️ PSI | 7 |
| ⚠️ CrUX | 4 |
| ⚠️ KW-UPLOAD | 13 |
| ⚠️ BL-UPLOAD | 18 |
| 🤖 AI (on-demand) | 27 |
| 📋 Manual | 50 |
| **Total** | **349** |

---

## Section 1 — Response Codes & Redirects

*Data source: `response.js` extractor (existing, needs redirect chain + loop detection added)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `http_status` | 200 Status Code | ✅ | critical | response.js | HTTP status = 200 for all indexable pages |
| `redirect_301_vs_302` | 301 vs 302 Usage | ✅ | warning | response.js | Permanent redirects must use 301, not 302 |
| `redirect_chain` | Redirect Chains | ✅ | critical | response.js | Follow chain; flag if length > 1 hop (A→B→C) |
| `redirect_loop` | Redirect Loops | ✅ | critical | response.js | Circular redirect detection (A→B→A) |
| `redirect_to_https` | Redirect to HTTPS | ✅ | critical | response.js | HTTP URL must redirect to HTTPS equivalent |
| `broken_pages_4xx` | 4xx Broken Pages | ✅ | critical | response.js | Any internal link returning 4xx |
| `server_errors_5xx` | 5xx Server Errors | ✅ | critical | response.js | Any 5xx status detected during crawl |
| `temp_redirect_overuse` | Temporary Redirect Overuse | ✅ | warning | response.js | 302 still in place after first crawl; flag on re-crawl comparison |
| `redirect_count` | Redirect Count | ✅ | info | response.js | Flag if total redirecting pages > 10% of crawled URLs |
| `gone_vs_not_found` | Gone vs Not Found | ✅ | info | response.js | Permanently deleted content should return 410, not 404 |

---

## Section 2 — Canonicalisation

*Data source: `canonical.js` extractor (existing)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `self_referencing_canonical` | Self-Referencing Canonical | ✅ | critical | canonical.js | Every indexable page must have `<link rel="canonical">` pointing to itself or valid consolidation URL |
| `duplicate_canonical_tags` | Duplicate Canonical Tags | ✅ | critical | canonical.js | Only one canonical tag per page; flag if multiple found |
| `canonical_points_https` | Canonical Points to HTTPS | ✅ | critical | canonical.js | Canonical `href` must use HTTPS scheme |
| `canonical_to_error` | Canonical to 4xx or 5xx | ✅ | critical | canonical.js | Fetch canonical target URL; flag if it returns non-200 |
| `canonical_loop` | Canonical Loops | ✅ | critical | canonical.js | Build canonical graph; detect circular chains (A→B→A) |
| `reciprocal_canonical` | Reciprocal Canonicals | ✅ | warning | canonical.js | If page A canonicals to B, verify B canonicals back to A |
| `trailing_slash_canonical` | Trailing Slash Canonical | ✅ | info | canonical.js | All canonicals use same trailing slash convention across the site |
| `paginated_canonical` | Paginated Pages Canonical | ✅ | warning | canonical.js | Each paginated page (`?page=N`) must self-canonical, not point to page 1 |
| `url_parameter_canonical` | URL Parameter Handling | ✅ | info | canonical.js | URLs with tracking params must canonical to clean version |
| `hreflang_canonical_conflict` | Hreflang vs Canonical Conflict | ✅ | warning | canonical.js | Cross-check: canonical URL must align with the hreflang annotation for that page |

---

## Section 3 — Robots & Crawl Directives

*Data source: new `robots.js` extractor (site-level, fetches `/robots.txt` and `/llms.txt` once per crawl)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `robots_txt_exists` | Robots.txt Exists | ✅ | critical | new: robots.js | `GET /robots.txt` returns 200 |
| `robots_txt_syntax` | Robots.txt Valid Syntax | ✅ | warning | new: robots.js | Parse with robots-parser; flag invalid directives |
| `sitemap_in_robots` | Sitemap Declared in Robots.txt | ✅ | info | new: robots.js | At least one `Sitemap:` line present |
| `crawlable_resources_not_blocked` | Crawlable Resources Not Blocked | ✅ | critical | new: robots.js | `/css`, `/js`, `/images` paths must not be in Disallow for `*` or `Googlebot` |
| `sensitive_paths_blocked` | Sensitive Paths Blocked | ✅ | warning | new: robots.js | `/admin`, `/wp-admin`, `/wp-login` should be Disallowed |
| `important_pages_not_blocked` | Important Pages Not Blocked | ✅ | critical | new: robots.js | Test each crawled indexable URL against parsed Disallow rules; flag matches |
| `conflicting_directives` | Conflicting Directives | ✅ | warning | new: robots.js | Flag if Allow and Disallow rules contradict for the same path |
| `ai_crawler_directives` | AI Crawler Directives | ✅ | info | new: robots.js | Check for explicit rules for `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended` |
| `noindex_not_disallowed` | Meta Noindex Not Contradicting Disallow | ✅ | warning | new: robots.js | Cross-check: noindex pages must not also be blocked (Googlebot can't read noindex if blocked) |
| `crawl_delay` | Crawl-Delay Set If Needed | ✅ | info | new: robots.js | Flag if no Crawl-delay is set for sites on shared/low-capacity hosting (detect via TTFB > 2s) |

---

## Section 4 — XML Sitemaps

*Data source: new `sitemap.js` extractor (site-level, fetches and parses `/sitemap.xml` once per crawl)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `sitemap_exists` | Sitemap Exists | ✅ | critical | new: sitemap.js | `/sitemap.xml` or sitemap URL from robots.txt returns 200 |
| `sitemap_valid_xml` | Valid XML Format | ✅ | warning | new: sitemap.js | Parse with `fast-xml-parser`; flag schema or parse errors |
| `sitemap_url_count` | Sitemap URL Count | ✅ | critical | new: sitemap.js | Each sitemap file must have ≤ 50,000 URLs (Google hard limit) |
| `sitemap_file_size` | Sitemap File Size | ✅ | critical | new: sitemap.js | Sitemap file must be ≤ 50MB uncompressed (Google hard limit) |
| `sitemap_index_used` | Sitemap Index for Large Sites | ✅ | info | new: sitemap.js | If multiple sitemap files exist, a sitemap index must be present |
| `no_blocked_urls_in_sitemap` | No Blocked URLs in Sitemap | ✅ | warning | new: sitemap.js | Cross-check sitemap URLs against robots.txt Disallow rules; flag matches |
| `no_4xx_in_sitemap` | No 4xx/5xx URLs in Sitemap | ✅ | warning | new: sitemap.js | Fetch each sitemap URL (HEAD request); flag non-200 responses |
| `no_redirect_in_sitemap` | No Redirect URLs in Sitemap | ✅ | warning | new: sitemap.js | Sitemap URLs must be the final canonical destination, not redirecting URLs |
| `sitemap_orphan_urls` | Orphan URLs in Sitemap | ✅ | info | new: sitemap.js | Pages in sitemap with zero internal inlinks from crawled pages |
| `sitemap_lastmod` | Lastmod Accuracy | ✅ | info | new: sitemap.js | Compare `<lastmod>` to HTTP `Last-Modified` header or `article:modified_time` meta |
| `sitemap_image` | Image Sitemap | ✅ | info | new: sitemap.js | Parse `<image:image>` entries; flag if image-heavy site has no image sitemap |
| `sitemap_video` | Video Sitemap | ✅ | info | new: sitemap.js | Parse `<video:video>` entries; flag if video site has no video sitemap |
| `noindex_in_sitemap` | No Noindexed URLs in Sitemap | ✅ | warning | new: sitemap.js | Cross-check sitemap URLs against crawled noindex pages; flag matches |
| `sitemap_submitted_gsc` | Sitemap Submitted to GSC | ⚠️ GSC | info | gsc.js | Call GSC Sitemaps API: `sitemaps.list` — verify at least one sitemap submitted |
| `news_sitemap` | News Sitemap | ✅ | info | new: sitemap.js | Parse sitemap XML for `<news:news>` elements using `fast-xml-parser`; if found, validate required fields: `news:publication` (with `news:name` + `news:language`), `news:title`, `news:publication_date`. Flag if any required field missing. Pass silently if no `<news:news>` elements found (site is not a news publisher) |

---

## Section 5 — Crawlability & Indexability

*Data source: `meta.js` (noindex), `links.js` (depth/orphans), `response.js` (status); new `url.js` (session IDs, crawl traps)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `meta_noindex_correct` | Meta Noindex Used Correctly | ✅ | critical | meta.js | Noindex must only appear on low-value pages (pagination, admin, duplicates); flag if on canonical pages |
| `x_robots_tag` | X-Robots-Tag Header | ✅ | critical | response.js | `X-Robots-Tag` header must align with `<meta name="robots">`; flag conflicts |
| `crawl_depth` | Crawl Depth | ✅ | info | links.js | Track depth of each URL from root; flag pages requiring > 4 clicks |
| `orphan_pages` | Orphan Pages | ✅ | warning | links.js | Pages with zero inbound internal links |
| `soft_404` | Soft 404 Detection | ✅ | warning | content.js | HTTP 200 + word count < 50 + matches "not found"/"404"/"doesn't exist" patterns |
| `session_ids_in_urls` | Session IDs in URLs | ✅ | critical | new: url.js | Regex: detect `JSESSIONID`, `sid=`, `sessionid=`, `PHPSESSID` in URL query strings |
| `crawl_trap` | Crawl Trap / Infinite Parameters | ✅ | critical | new: url.js | Detect repeating path segments (`/a/b/a/b/`) or URLs with 5+ query parameters |
| `url_parameters_handled` | URL Parameters Handled | ✅ | warning | canonical.js | Detect parameter-created duplicate URLs lacking canonical consolidation |
| `nofollow_internal_links` | Nofollow Internal Links | ✅ | warning | links.js | Flag if > 5% of internal links use `rel="nofollow"` |
| `noindex_paginated` | Noindex on Paginated Pages | ✅ | info | meta.js | Paginated pages must have consistent strategy: either self-canonical or noindex (not mixed) |

---

## Section 6 — URL Structure

*Data source: new `url.js` extractor (parses URL components per page)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `url_length` | URL Length | ✅ | info | new: url.js | Flag URLs > 100 characters; ideal < 75 |
| `url_lowercase` | Lowercase Characters | ✅ | warning | new: url.js | Flag URLs with mixed-case path segments |
| `url_hyphens` | Hyphen Word Separators | ✅ | warning | new: url.js | Flag slugs using underscores `_` or spaces instead of hyphens `-` |
| `url_special_chars` | Special Characters in Slug | ✅ | warning | new: url.js | Flag percent-encoded special characters in path (excluding `/`, `-`) |
| `url_keyword` | Keyword in URL | ⚠️ KW-UPLOAD | info | new: url.js | Check if primary keyword from mapping appears in URL slug |
| `url_descriptive` | Descriptive URL Slugs | ✅ | info | new: url.js | Flag generic slugs: `/page-\d+`, `/p=`, `/content/\d+`, `/index` |
| `url_trailing_slash` | Trailing Slash Consistency | ✅ | warning | new: url.js | Compare trailing slash across all crawled URLs; flag inconsistency |
| `url_deep_nesting` | Deep Nesting | ✅ | warning | new: url.js | Flag URLs with > 4 directory levels (count `/` in path) |
| `subdomain_vs_subfolder` | Subdomain vs Subfolder | ✅ | info | new: url.js | From crawled `<a href>` set: extract hostnames; detect if key content paths (blog, docs, shop, news) exist on a subdomain (`blog.domain.com`) rather than a subdirectory (`/blog`). Flag info if subdomain-hosted content found. Also flag if both patterns coexist (e.g. `/en/` subdirectory AND `en.domain.com` subdomain) |
| `url_date_format` | Date Format in URLs | ✅ | info | new: url.js | If dates present in URLs, verify consistent format (`YYYY/MM/DD` or `YYYY-MM-DD`) |

---

## Section 7 — JavaScript Rendering

*Data source: new `jsrender.js` extractor (dual-mode: raw Cheerio fetch + Playwright render comparison)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `js_critical_content` | Critical Content in Raw HTML | ✅ | critical | new: jsrender.js | H1, main body text, and internal nav links must exist in raw HTML (Cheerio pass), not only in Playwright DOM |
| `js_metadata` | Metadata in Raw HTML | ✅ | critical | new: jsrender.js | `<title>` and `<meta name="description">` must be present in raw HTML source |
| `js_link_discovery` | Link Discovery via JS | ✅ | critical | new: jsrender.js | Count `<a href>` in raw HTML vs Playwright DOM; flag if Playwright discovers > 20% more links |
| `js_structured_data` | Structured Data Rendering | ✅ | warning | new: jsrender.js | JSON-LD blocks must be present in raw HTML; flag if only injected after JS execution |
| `js_render_comparison` | Render Comparison | ✅ | warning | new: jsrender.js | Diff raw HTML text vs Playwright DOM text; flag if rendered content is > 30% different from raw |
| `js_csr_vs_ssr` | CSR vs SSR | ✅ | info | new: jsrender.js | Derived from `js_render_comparison`: if raw HTML has < 100 words but Playwright has > 300, flag as full CSR |
| `js_two_wave_risk` | Two-Wave Indexing Risk | ✅ | info | new: jsrender.js | Flag if core value content (H1, pricing, key CTAs) only appears in Playwright DOM |
| `js_lazy_loaded` | Lazy-Loaded Content | ✅ | warning | new: jsrender.js | Playwright: scroll to bottom; flag content that only appears post-scroll if it contains internal links or heading text |
| `js_dependencies_order` | JS Dependencies Load Order | ✅ | info | new: jsrender.js | Playwright: detect render-blocking `<script>` tags in `<head>` without `defer` or `async` |
| `js_crawl_budget_render` | Crawl Budget vs Rendering Time | ✅ | warning | new: jsrender.js | Playwright: measure time from navigation start to `domContentLoaded`; flag if > 2 seconds |

---

## Section 8 — Mobile & Usability

*Data source: `meta.js` (viewport); new `mobile.js` extractor (Playwright mobile viewport)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `viewport_meta` | Viewport Meta Tag | ✅ | critical | meta.js | `<meta name="viewport" content="width=device-width, initial-scale=1">` must be present |
| `mobile_responsive` | Mobile Responsiveness | ✅ | critical | new: mobile.js | Playwright: load in 375px viewport; flag if `document.body.scrollWidth > window.innerWidth` |
| `tap_target_size` | Tap Target Size | ✅ | warning | new: mobile.js | Playwright: `getBoundingClientRect` on all `<a>` and `<button>`; flag if width or height < 48px |
| `text_legibility` | Text Size Legibility | ✅ | warning | new: mobile.js | Playwright: `getComputedStyle` on body text; flag if font-size < 16px |
| `horizontal_scroll` | Horizontal Scroll | ✅ | critical | new: mobile.js | Playwright mobile: flag if `document.documentElement.scrollWidth > document.documentElement.clientWidth` |
| `zoom_disabled` | Zoom Disabled | ✅ | warning | meta.js | Flag if viewport meta contains `user-scalable=no` or `maximum-scale=1` |
| `mobile_interstitials` | Interstitials on Mobile | ✅ | warning | new: mobile.js | Playwright mobile: detect fixed-position full-viewport overlays on page load |
| `mobile_content_parity` | Content Parity Mobile vs Desktop | ✅ | critical | new: mobile.js | Playwright: diff H1 + word count between desktop (1280px) and mobile (375px) renders; flag > 15% difference |
| `touch_spacing` | Touch Spacing | ✅ | warning | new: mobile.js | Playwright: check spacing between adjacent tap targets; flag if < 8px gap |
| `mobile_speed` | Mobile Speed | ⚠️ PSI | critical | psi.js | Mobile LCP from PageSpeed Insights; flag if > 2.5s |
| `app_install_banners` | App Install Banners | ✅ | info | new: mobile.js | Playwright mobile (375px): detect fixed-position elements covering > 60% of viewport on initial page load that contain links to `play.google.com` or `apps.apple.com`, or text matching `/(download|install|get).*(app|ios|android)/i`. Distinct from `mobile_interstitials` (any overlay) — this specifically targets app-store promotion banners |

---

## Section 9 — Security & HTTPS

*Data source: `response.js` (headers); new `monitoring.js` extractor (SSL, mixed content)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `https_enabled` | HTTPS Enabled | ✅ | critical | response.js | All crawled pages must be served over HTTPS |
| `ssl_valid` | SSL Certificate Valid | ✅ | critical | new: monitoring.js | Check cert expiry date and issuing CA trust chain via TLS handshake |
| `ssl_chain_complete` | SSL Certificate Chain Complete | ✅ | critical | new: monitoring.js | Intermediate certificates must be present; detect incomplete chain errors |
| `hsts_header` | HSTS Header | ✅ | warning | response.js | `Strict-Transport-Security` header with `max-age` ≥ 31,536,000 |
| `csp_header` | Content Security Policy | ✅ | warning | response.js | `Content-Security-Policy` header present; flag if missing or set to `unsafe-inline` only |
| `x_frame_options` | X-Frame-Options | ✅ | warning | response.js | Header must be `DENY` or `SAMEORIGIN` |
| `x_content_type_options` | X-Content-Type-Options | ✅ | warning | response.js | Header must be `nosniff` |
| `referrer_policy` | Referrer-Policy | ✅ | info | response.js | `Referrer-Policy` header must be present |
| `mixed_content` | Mixed Content | ✅ | critical | new: monitoring.js | Playwright: intercept network requests; flag any `http://` resource loaded on an `https://` page |
| `security_headers_grade` | Security Headers Grade | ✅ | warning | new: monitoring.js | Composite check: score presence of HSTS + CSP + X-Frame-Options + X-Content-Type-Options + Referrer-Policy; flag if < 4/5 |
| `permissions_policy` | Permissions-Policy | ✅ | info | response.js | `Permissions-Policy` header restricting camera/microphone/geolocation must be present |

---

## Section 10 — Core Web Vitals

*Data source: Playwright (lab/timing); `psi.js` (PSI API); new `crux.js` (CrUX API field data)*

### Lab / Playwright-Measured

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `lab_ttfb` | TTFB (Time to First Byte) | ✅ | info | new: monitoring.js | Playwright: `performance.timing.responseStart - performance.timing.requestStart`; flag if > 800ms |
| `lab_render_blocking` | Render Blocking Resources | ✅ | warning | resources.js | Detect `<script>` and `<link rel="stylesheet">` in `<head>` without `defer`/`async`/`media` attributes |
| `lab_request_count` | Total Network Requests | ✅ | info | new: monitoring.js | Playwright: intercept all requests; flag if total > 100 |
| `lab_asset_weight` | JS + CSS Asset Weight | ✅ | info | new: monitoring.js | Playwright: sum transferred bytes for JS and CSS; flag if > 500KB combined |

### PSI API (per URL sample)

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `psi_lcp` | LCP (Largest Contentful Paint) | ⚠️ PSI | critical | psi.js | PSI mobile LCP; thresholds: good < 2.5s, poor ≥ 4s |
| `psi_cls` | CLS (Cumulative Layout Shift) | ⚠️ PSI | critical | psi.js | PSI mobile CLS; thresholds: good < 0.1, poor ≥ 0.25 |
| `psi_fcp` | FCP (First Contentful Paint) | ⚠️ PSI | info | psi.js | PSI mobile FCP; thresholds: good < 1.8s, poor ≥ 3s |
| `psi_score` | Lighthouse Performance Score | ⚠️ PSI | info | psi.js | PSI mobile performance score; flag if < 50 |
| `mobile_cwv` | Mobile CWV Performance | ⚠️ PSI | critical | psi.js | All 3 CWV (LCP + CLS + FCP) must pass on mobile PSI |
| `cwv_pass_rate` | CWV Pass Rate | ⚠️ PSI | critical | psi.js | ≥ 75% of sampled pages must pass all PSI CWV thresholds |

### CrUX API (real-user field data, p75)

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `crux_lcp` | CrUX LCP (real users, p75) | ⚠️ CrUX | critical | new: crux.js | CrUX API p75 LCP; thresholds: good < 2.5s, poor ≥ 4s. Report `passed: true, severity: info` if no CrUX data |
| `crux_inp` | CrUX INP (real users, p75) | ⚠️ CrUX | critical | new: crux.js | CrUX API p75 INP; thresholds: good < 200ms, poor ≥ 500ms |
| `crux_cls` | CrUX CLS (real users, p75) | ⚠️ CrUX | critical | new: crux.js | CrUX API p75 CLS; thresholds: good < 0.1, poor ≥ 0.25 |

### Playwright-Measured (LCP + CLS element inspection)

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `lcp_element_id` | LCP Element Identification | ✅ | info | new: monitoring.js | Playwright `PerformanceObserver` on `largest-contentful-paint`; read `entry.element.tagName` + class. Flag if LCP element is decorative (`<svg>`, background `<div>`, or element inside `<nav>`/`<header>`) |
| `cls_causes` | CLS Causes | ✅ | warning | new: monitoring.js | Playwright `PerformanceObserver` on `layout-shift`; collect `entry.sources[].node` (tagName, id, className) + shift delta. Flag top-shifting elements where `hadRecentInput = false` |
| `cwv_trend` | CWV Trend Over Time | ⚠️ CrUX | warning | new: crux.js | CrUX History API (`queryHistoryRecord` endpoint) — returns week-by-week p75 data for up to 25 weeks. Compare latest week vs 4-weeks-prior; flag if LCP / INP / CLS worsened by > 15% |

---

## Section 11 — Title Tags

*Data source: `meta.js` extractor (existing)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `title_present` | Title Tag Present | ✅ | critical | meta.js | Every indexable page must have a `<title>` tag |
| `title_unique` | Title Tag Unique | ✅ | critical | meta.js | No duplicate `<title>` values across the crawl |
| `title_length_chars` | Title Tag Length (Characters) | ✅ | warning | meta.js | Optimal: 50–60 chars; flag if < 30 or > 75 |
| `title_pixel_width` | Title Tag Pixel Width | ✅ | warning | meta.js | Approximate pixel width using average char width (6px); flag if > 600px |
| `title_primary_keyword` | Primary Keyword in Title | ⚠️ KW-UPLOAD | warning | meta.js | Check if primary keyword from mapping is present in title; case-insensitive |
| `title_keyword_position` | Keyword Position in Title | ⚠️ KW-UPLOAD | warning | meta.js | Primary keyword must appear within first 35 characters of title |
| `title_brand` | Brand in Title | ✅ | info | meta.js | Brand name (from site settings) must appear in title, typically after `|` or `—` separator |
| `title_keyword_stuffing` | Keyword Stuffing in Title | ✅ | warning | meta.js | Flag if any single word appears 3+ times in the title |
| `title_relevance` | Title Relevance to Content | 🤖 | warning | ai.service.js | AI: compare title text to H1 and first 200 words; flag if topic overlap < 40% |
| `title_h1_diff` | Title vs H1 Differentiation | ✅ | info | meta.js | Flag if title text is identical to H1 text (missed targeting opportunity) |

---

## Section 12 — Meta Descriptions

*Data source: `meta.js` extractor (existing)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `meta_desc_present` | Meta Description Present | ✅ | warning | meta.js | Every page must have `<meta name="description">` |
| `meta_desc_unique` | Meta Description Unique | ✅ | critical | meta.js | No duplicate description values across crawl |
| `meta_desc_length` | Meta Description Length | ✅ | warning | meta.js | Optimal: 140–160 chars; flag if < 120 or > 165 |
| `meta_desc_keyword` | Keyword in Description | ⚠️ KW-UPLOAD | warning | meta.js | Primary keyword from mapping must appear in description |
| `meta_desc_cta` | Call-to-Action in Description | ✅ | info | meta.js | Regex: flag if meta description does not contain an action verb in first 15 words. Pattern: `/\b(get|compare|check|buy|learn|find|apply|download|try|start|explore|discover|see|view|read|calculate|plan|save|earn|invest)\b/i` — no AI needed |
| `meta_desc_accuracy` | Description Accuracy | 🤖 | warning | ai.service.js | AI: compare description text to page content; flag if misleading or mismatched |
| `meta_desc_keyword_position` | Keyword Position in Description | ⚠️ KW-UPLOAD | info | meta.js | Primary keyword must appear within first 50 characters of description |
| `meta_desc_no_html` | No HTML Tags in Description | ✅ | info | meta.js | Detect HTML tags inside description content with regex |
| `meta_desc_encoding` | Special Character Encoding | ✅ | info | meta.js | Flag broken/garbled characters in description text |
| `meta_desc_auto_generated` | Duplicate Auto-Generated Descriptions | ✅ | critical | meta.js | Detect templated descriptions: same prefix/suffix pattern across 3+ pages |

---

## Section 13 — Headings

*Data source: `headings.js` extractor (existing)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `h1_present` | H1 Present | ✅ | critical | headings.js | Every indexable page must have exactly one `<h1>` tag |
| `h1_unique` | H1 Unique Across Site | ✅ | critical | headings.js | No duplicate H1 text across the crawl |
| `h1_relevance` | H1 Content Relevance | 🤖 | warning | ai.service.js | AI: verify H1 describes the page topic relative to title and body content |
| `h1_length` | H1 Length | ✅ | info | headings.js | Flag H1 < 4 or > 100 characters |
| `h2_structure` | H2 Structure | ✅ | warning | headings.js | Flag pages with no H2s on content pages with > 300 words |
| `heading_hierarchy` | Heading Hierarchy | ✅ | critical | headings.js | Flag if any heading level is skipped (H1→H3, H2→H4, etc.) |
| `h3_h6_nesting` | H3–H6 Nesting Order | ✅ | warning | headings.js | H3s must be under H2s; H4s under H3s; flag any out-of-order nesting |
| `h1_keyword` | Keyword in H1 | ⚠️ KW-UPLOAD | warning | headings.js | Primary keyword from mapping must be present in H1; case-insensitive |
| `h2_keyword` | Keyword in H2s | ⚠️ KW-UPLOAD | info | headings.js | At least one H2 must contain a related/secondary keyword from mapping |
| `heading_stuffing` | Keyword Stuffing in Headings | ✅ | warning | headings.js | Flag if any single keyword appears 3+ times across all heading tags on the page |

---

## Section 14 — Content Quality

*Data source: `content.js` extractor (existing, needs Levenshtein + Flesch + hash additions)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `word_count` | Minimum Word Count | ✅ | warning | content.js | Strip HTML; flag indexable pages with < 300 words |
| `cornerstone_word_count` | Cornerstone Content Word Count | ⚠️ KW-UPLOAD | warning | content.js | Pages marked as "pillar" in keyword mapping must have ≥ 1,500 words |
| `thin_content` | Thin Content Detection | ✅ | critical | content.js | Flag pages with < 300 words that are not pagination/login/utility pages |
| `duplicate_content` | Duplicate Content Internal | ✅ | critical | content.js | SHA-256 hash of extracted body text; flag pages with identical hash to another crawled page |
| `near_duplicate` | Near-Duplicate Content | ✅ | warning | content.js | Use MinHash/SimHash for pre-filtering; only run full similarity on same-word-count candidates (±10%). Full Levenshtein is O(n²) — only use on sites ≤ 200 pages. Flag pairs with similarity > 80% |
| `keyword_density` | Keyword Density | ⚠️ KW-UPLOAD | info | content.js | Primary keyword occurrence / total words; flag if > 3% |
| `keyword_variations` | Keyword Variations Used | ⚠️ KW-UPLOAD | info | content.js | Check if at least 2 semantic variations from keyword mapping appear in body text |
| `content_freshness` | Content Freshness | ✅ | info | content.js | Read `article:modified_time` meta or HTTP `Last-Modified` header; flag if > 12 months old |
| `readability_score` | Readability Score | ✅ | warning | content.js | Compute Flesch Reading Ease from extracted text; flag if score < 60 |
| `original_research` | Original Research or Data | 📋 | info | — | Human: verify page contains proprietary data, original stats, or unique analysis |
| `content_purpose` | Content Purpose Clarity | 🤖 | info | ai.service.js | AI: verify purpose of content is evident from opening paragraph |
| `fact_checking` | Fact Checking | 📋 | warning | — | Human: verify claims are backed by sources; critical for YMYL pages |
| `expert_attribution` | Expert Attribution | ✅ | info | content.js | On content pages (> 300 words): detect visible author signal — any of: `[rel="author"]` link, `[itemprop="author"]` element, element with class matching `/author|byline|writer/i`, or text matching `/^by\s+[A-Z][a-z]+(\s[A-Z][a-z]+)+/m` ("By Priya Sharma"). Flag info if no author signal found |
| `actionable_content` | Actionable Content | 🤖 | info | ai.service.js | AI: verify content gives readers something specific and practical to act on |
| `content_intent_match` | Content-Search Intent Match | 🤖 | critical | ai.service.js | AI: classify page intent (informational / transactional / navigational / commercial); flag if format mismatches intent |

---

## Section 15 — Images

*Data source: `images.js` extractor (existing, needs file-size fetch and srcset additions)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `img_alt_missing` | Alt Text Missing | ✅ | critical | images.js | `<img>` without any `alt` attribute |
| `img_alt_empty` | Alt Text Empty (non-decorative) | ✅ | warning | images.js | `<img alt="">` on images that appear to be content images (inside `<article>`, `<main>`) |
| `img_alt_duplicate` | Duplicate Alt Text | ✅ | warning | images.js | Same `alt` value on 3+ different images across the site |
| `img_alt_descriptive` | Alt Text Descriptive | ✅ | warning | images.js | Regex: flag `<img>` where `alt` matches `/^(image|photo|img|pic|picture|graphic|screenshot|banner|thumbnail)s?(\s*\d+)?$/i` or looks like a filename `/\.(jpe?g|png|gif|webp|svg|avif)$/i`. Pure pattern match — no AI required |
| `img_decorative_handling` | Decorative Image Handling | ✅ | info | images.js | Decorative images (inside `<figure>` with no caption, or background role) must have `alt=""` |
| `img_file_name` | Image File Name | ✅ | info | images.js | Flag images with generic filenames: `image\d+`, `IMG_`, `photo`, `pic`, `screenshot` |
| `img_format` | Image File Format | ✅ | info | images.js | Flag BMP and TIFF formats; flag PNG and JPEG files not served via `<picture>` element with a WebP/AVIF `<source>` — recommend conversion but do not compare file sizes (requires conversion, not feasible during crawl) |
| `img_file_size` | Image File Size | ✅ | warning | images.js | HEAD request for each image `src`; flag if `Content-Length` > 200KB |
| `img_dimensions` | Image Dimensions Declared | ✅ | info | images.js | Flag `<img>` missing both `width` and `height` attributes (causes CLS) |
| `img_lazy_loading` | Lazy Loading | ✅ | info | images.js | Flag images below fold (position > 800px) missing `loading="lazy"` |
| `img_srcset` | Responsive Images Srcset | ✅ | info | images.js | Flag `<img>` without `srcset` or `sizes` on pages that serve the same image to all screen sizes |
| `img_compression` | Image Compression Quality | ✅ | warning | images.js | Fetch image; compare file size to dimensions × expected bytes-per-pixel; flag if > 3× expected |
| `img_aspect_ratio` | Width-Height Aspect Ratio | ✅ | info | images.js | Playwright: compare `naturalWidth/naturalHeight` to `offsetWidth/offsetHeight`; flag distorted images |
| `img_next_gen` | Next-Gen Format Adoption | ✅ | info | images.js | Flag pages not using `<picture>` element or WebP/AVIF for any images |
| `img_broken` | Broken Images | ✅ | critical | images.js | Image `src` returns 4xx; detected during crawl |
| `img_schema` | Image Schema Markup | ✅ | info | schema.js | Check for `ImageObject` JSON-LD on pages where `<img>` appears inside `<article>` or `<figure>` without `role="presentation"`; flag if no `ImageObject` with `url`, `width`, `height` present |
| `img_content_relevance` | Image Content Relevance | 📋 | info | — | Human: verify images support article topic (not generic stock photos) |

---

## Section 16 — Schema & Structured Data

*Data source: `schema.js` extractor (existing)*

### 16a — User-Configured Schema Rules

> **What this is:** A per-site URL-pattern → required schema type mapping, configured in the site's Schema Rules UI. This is more authoritative than the heuristic individual checks below — when a matching rule exists for a URL, `schema_rules` is the primary verdict; the heuristic checks become supplementary.

**How it works:**
1. Each site has a list of `SchemaRule` objects: `{ pattern: string, required: string[] }`
2. Rules are evaluated top-to-bottom for each crawled URL; first match wins
3. A catch-all `{ pattern: "*", required: ["WebPage"] }` is always present at the bottom as the fallback
4. The check verifies: `required` ⊆ `@type values found in page JSON-LD`; flag each missing type

**Example:**
```
URL: /health/car-insurance
Matched rule: /health/*
Required: ["Product", "FAQPage", "BreadcrumbList"]
Found in JSON-LD: ["FAQPage", "BreadcrumbList"]
✗ Missing: Product → fail, severity: warning
```

**16 predefined schema types** (shown as checkboxes in UI):
`WebPage`, `Product`, `FAQPage`, `NewsArticle`, `Article`, `BlogPosting`, `BreadcrumbList`, `DiscussionForumPosting`, `QAPage`, `ItemList`, `Event`, `HowTo`, `Review`, `LocalBusiness`, `Organization`, `SiteNavigationElement`

**Personalised / custom schema types:** Free-text entry supported — any valid `schema.org` or extended `@type` value. Examples for insurance/finance sites: `InsuranceAgency`, `FinancialProduct`, `HealthInsurancePlan`, `MotorInsurance`, `TermInsurance`. Custom types are saved to the site's schema rules and reappear in future rule edits.

**Platform requirement (new UI):** Schema Rules editor in site settings — add/remove/reorder rules, glob pattern input, predefined type checkboxes + custom type free-text, import/export JSON for batch operations.

**Storage:** New `schema_rules` table in SQLite: `(id, site_id, pattern, required_types JSON, sort_order)`.

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `schema_rules` | Schema Rules (URL Pattern Mapping) | ✅ | warning | schema.js | Match crawled URL against user-defined rules (top-to-bottom, first match wins). Verify all `@type` values in matched rule's `required` array are present in page JSON-LD. Report each missing type as a separate `details` entry. Skip (pass silently) if site has no schema rules configured — falls back to heuristic checks below |

---

### 16b — Heuristic Schema Checks

*Run on every crawl regardless of schema rules. Used when no matching rule exists, and as supplementary signals when rules are configured.*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `schema_present` | Schema Markup Present | ✅ | critical | schema.js | At least one valid JSON-LD block must be present on every key page |
| `schema_json_ld` | JSON-LD Format Used | ✅ | warning | schema.js | Flag use of Microdata or RDFa; JSON-LD is preferred |
| `schema_validation` | Schema Validation (Schema.org) | ✅ | warning | schema.js | Parse JSON-LD; flag malformed JSON or unknown `@type` values |
| `schema_rich_results` | Google Rich Results Eligibility | ✅ | warning | schema.js | Heuristic: check required fields for detected schema type (e.g. `name`, `image`, `datePublished` for Article) |
| `schema_article` | Article Schema | ✅ | info | schema.js | Flag content pages without `Article`/`BlogPosting`/`NewsArticle` schema; check for `headline`, `datePublished`, `author`, `image` |
| `schema_product` | Product Schema | ✅ | info | schema.js | Flag product pages without `Product` schema; check for `name`, `price`, `availability` |
| `schema_review` | Review / Rating Schema | ✅ | info | schema.js | Flag pages with visible star ratings but no `AggregateRating` or `Review` schema |
| `schema_faq` | FAQ Schema | ✅ | info | schema.js | Flag pages with FAQ-style content (Q&A headings) but no `FAQPage` schema |
| `schema_breadcrumb` | Breadcrumb Schema | ✅ | info | schema.js | Flag pages with visible breadcrumb nav but no `BreadcrumbList` schema |
| `schema_local_business` | LocalBusiness Schema | ✅ | info | schema.js | Flag local business pages without `LocalBusiness` schema; check for `name`, `address`, `telephone`, `openingHours` |
| `schema_video` | Video Schema | ✅ | info | schema.js | Flag pages with embedded video but no `VideoObject` schema |
| `schema_event` | Event Schema | ✅ | info | schema.js | Flag event pages without `Event` schema |
| `schema_organization` | Organization Schema | ✅ | info | schema.js | Flag homepage without `Organization` or `WebSite` schema |
| `schema_howto` | HowTo Schema | ✅ | info | schema.js | Flag instructional/step-by-step content without `HowTo` schema |
| `schema_author` | Author Schema | ✅ | info | schema.js | Parse `author` property in `Article`/`BlogPosting`/`NewsArticle` JSON-LD; flag if `author.name` is absent or if `author.sameAs` array is missing entirely |

---

## Section 17 — Internal Linking

*Data source: `links.js` extractor (existing)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `internal_links_200` | Internal Links Return 200 | ✅ | critical | links.js | All internal `<a href>` links must resolve to 200; fetch each during crawl |
| `no_orphan_pages` | No Orphan Pages | ✅ | warning | links.js | Build inlink graph; flag all indexable pages with zero inbound internal links |
| `internal_link_count` | Internal Link Count per Page | ✅ | warning | links.js | Flag pages with > 100 total internal outbound links |
| `internal_crawl_depth` | Crawl Depth | ✅ | warning | links.js | Track depth of each page from root via BFS; flag important pages > 4 clicks deep |
| `anchor_descriptiveness` | Anchor Text Descriptiveness | ✅ | warning | links.js | Flag internal links with generic anchor text: "click here", "read more", "here", "this", "link" |
| `anchor_exact_match` | Exact Match Anchor Overuse | ✅ | info | links.js | Group inlinks by target URL; flag if all anchors to a page use identical exact-match keyword text |
| `internal_nofollow` | Nofollow on Internal Links | ✅ | warning | links.js | Flag if > 5% of internal links use `rel="nofollow"` |
| `links_to_important_pages` | Links to Important Pages | 📋 | info | — | Human: verify key conversion pages receive internal links from high-traffic pages |
| `broken_internal_links` | Broken Internal Links | ✅ | critical | links.js | Same as `internal_links_200`; surface as separate issue type with broken URL detail |
| `redirect_internal_links` | Redirect Internal Links | ✅ | warning | links.js | Flag internal links that resolve via redirect (3xx); update links to point to final URL |

---

## Section 18 — International SEO

*Data source: `canonical.js` extractor (existing, has hreflang parsing)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `hreflang_present` | Hreflang Tags Present | ✅ | critical | canonical.js | Detect `<link rel="alternate" hreflang="...">` on international pages |
| `hreflang_self_ref` | Hreflang Self-Reference | ✅ | critical | canonical.js | Each page must include its own URL + `hreflang` value in the hreflang set |
| `hreflang_reciprocal` | Hreflang Reciprocal | ✅ | critical | canonical.js | Build hreflang graph; every referenced URL must reciprocate with matching annotation |
| `hreflang_x_default` | x-default Hreflang | ✅ | warning | canonical.js | `hreflang="x-default"` must be present in the set for pages targeting multiple regions |
| `hreflang_lang_valid` | Hreflang Language Code Validity | ✅ | warning | canonical.js | Validate against ISO 639-1 language codes and ISO 3166-1 region codes |
| `hreflang_url_consistent` | Hreflang URL Consistency | ✅ | critical | canonical.js | All URLs in a hreflang set must use the same format (trailing slash, protocol, www) |
| `hreflang_indexed` | Alternate Language Pages Indexed | ✅ | warning | canonical.js | Fetch each hreflang alternate URL; flag if it returns non-200 or has `noindex` |
| `content_language_match` | Content Language Match | ✅ | critical | canonical.js | Extract body text (strip nav/header/footer); run `franc` language detection (npm: `franc-min`); compare ISO 639-1 code to `hreflang` value for the page. Flag if detected language differs from declared hreflang. Pass as `info` (not fail) if body text < 200 words — too short for reliable detection |
| `intl_url_strategy` | ccTLD vs Subdirectory Strategy | ✅ | info | canonical.js | From crawled hreflang alternates and internal link hostnames: detect which international URL strategy is in use (ccTLD, subdomain, subdirectory). Flag if multiple strategies coexist (e.g. `/en/` subdirectory on some pages and `en.domain.com` subdomain on others). Report detected strategy in `details` |
| `locale_formatting` | Currency / Date Localization | ✅ | info | content.js | On pages with `hreflang` declared: extract currency symbols and date format patterns from visible body text via regex. Flag if detected currency (₹/INR, $/USD, £/GBP, €/EUR, AED) is inconsistent with hreflang locale — e.g. `$` amounts on `hreflang="en-IN"` page. Similarly flag US-style `MM/DD/YYYY` dates on non-US locale pages |

---

## Section 19 — Rankings & Traffic

*Data source: `gsc.js`, `ga4.js` routes (existing integrations)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `gsc_connected` | Google Search Console Connected | ⚠️ GSC | critical | gsc.js | Verify GSC property is verified and API returning data for this site |
| `ga4_connected` | GA4 Connected | ⚠️ GA4 | critical | ga4.js | Verify GA4 measurement ID is firing correctly (no double-firing) |
| `organic_traffic_trend` | Organic Traffic Trend | ⚠️ GSC | warning | gsc.js | Compare current 28-day organic clicks vs prior 28-day; flag if decline > 20% |
| `avg_ctr` | Click-Through Rate (CTR) | ⚠️ GSC | warning | gsc.js | GSC average CTR across all queries; flag if < 1% |
| `avg_position_trend` | Average Position Trend | ⚠️ GSC | info | gsc.js | Compare average SERP position over rolling 90 days; flag if worsening |
| `impressions_growth` | Impressions Growth | ⚠️ GSC | info | gsc.js | Compare impressions MoM; flag if declining consistently for 3+ months |
| `crawl_coverage_gsc` | Crawl Coverage in GSC | ⚠️ GSC | warning | gsc.js | GSC Coverage report: flag if > 10% of valid pages excluded from index |
| `core_update_impact` | Core Update Impact Detection | ⚠️ GSC | warning | gsc.js | Flag if traffic dropped > 20% within 2 weeks of a known Google core update date |
| `cannibalization_gsc` | Cannibalization Detection | ⚠️ GSC | warning | gsc.js | Detect multiple pages ranking for the same query (same keyword in top impressions for 2+ URLs) |
| `featured_snippet_gsc` | Featured Snippet Presence | ⚠️ GSC | info | gsc.js | Flag target queries where site is in position 1–3 but no featured snippet captured |
| `serp_features_gsc` | SERP Feature Presence | ⚠️ GSC | info | gsc.js | Cross-check schema presence vs GSC rich result impressions; flag schema present but no rich results |
| `branded_traffic_split` | Branded vs Non-Branded Split | ⚠️ GSC | info | gsc.js | Filter queries containing brand name; flag if branded traffic > 80% of total organic |
| `keyword_rankings_tracked` | Keyword Rankings Tracked | 📋 | info | — | Human: verify primary keywords are being monitored in GSC or rank tracking tool |

---

## Section 20 — Backlinks & Authority

*Data source: new `backlinks.service.js` — reads from `backlinks` table populated via CSV upload or manual entry*

**Upload format (Semrush/Ahrefs compatible CSV):** `source_url`, `target_url`, `anchor_text`, `domain_rating`, `is_dofollow` (boolean), `first_seen_date`, `link_type` (editorial / guest_post / pr / directory / other)

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `referring_domain_count` | Referring Domain Count | ⚠️ BL-UPLOAD | info | new: backlinks.service.js | Count unique referring domains in uploaded data; flag if declining vs previous upload |
| `referring_domain_authority` | Referring Domain Authority | ⚠️ BL-UPLOAD | warning | new: backlinks.service.js | Distribution of `domain_rating`; flag if > 50% of links from domains with DR < 20 |
| `anchor_text_distribution` | Anchor Text Distribution | ⚠️ BL-UPLOAD | warning | new: backlinks.service.js | Classify anchors as branded / generic / keyword / URL; flag if exact-match keyword > 40% of total |
| `toxic_links` | Toxic / Spammy Links | ⚠️ BL-UPLOAD | critical | new: backlinks.service.js | Flag links from domains with DR = 0 or `link_type = other` + DR < 5 as potential spam |
| `dofollow_nofollow_ratio` | Dofollow vs Nofollow Ratio | ⚠️ BL-UPLOAD | info | new: backlinks.service.js | Flag if 100% dofollow from suspicious sources (DR < 10, first_seen < 30 days ago) |
| `link_velocity` | Link Velocity | ⚠️ BL-UPLOAD | info | new: backlinks.service.js | Group links by `first_seen_date` by month; flag sudden spike (> 3× monthly average) |
| `lost_backlinks` | Lost Backlinks | ⚠️ BL-UPLOAD | warning | new: backlinks.service.js | Links present in previous upload but absent in current upload; flag if > 10% of total lost |
| `competitor_link_gap` | Competitor Backlink Gap | ⚠️ BL-UPLOAD | info | new: backlinks.service.js | If competitor backlink CSV uploaded, flag referring domains in competitor set not in own set |
| `paid_link_detection` | Editorial Link vs Paid Link | ⚠️ BL-UPLOAD | critical | new: backlinks.service.js | Flag `link_type = guest_post` or `link_type = pr` links without `rel="sponsored"` attribute |
| `link_diversity` | Link Diversity (Content Type) | ⚠️ BL-UPLOAD | info | new: backlinks.service.js | Check variety of `link_type` values; flag if single type > 80% of profile |
| `internal_pagerank` | Internal PageRank Distribution | ✅ | warning | links.js | Iterative PageRank on internal link graph from crawl data; flag high-priority pages with low PageRank |
| `domain_authority_trend` | Domain Authority Trend | ⚠️ BL-UPLOAD | info | new: backlinks.service.js | Compare `domain_rating` distribution across upload history; flag declining trend |
| `homepage_link_concentration` | Homepage Link Concentration | ⚠️ BL-UPLOAD | info | new: backlinks.service.js | Flag if > 80% of all backlinks point to homepage only |
| `unlinked_brand_mentions` | Brand Mentions (Unlinked) | ⚠️ BL-UPLOAD | info | new: backlinks.service.js | Flag source URLs in upload containing brand name in anchor text but `is_dofollow = false` with zero link equity |
| `disavow_status` | Disavow File Status | 📋 | info | — | Human: verify disavow file is maintained and submitted to GSC for toxic link domains |
| `competitor_authority` | Competitor Authority Score | ⚠️ BL-UPLOAD | info | new: backlinks.service.js | Compare own average DR to competitor upload average DR |
| `edu_gov_links` | Edu / Gov Links | ⚠️ BL-UPLOAD | info | new: backlinks.service.js | Flag if no `.edu` or `.gov` domains present in referring domain set |
| `niche_relevance` | Niche Relevance of Links | ⚠️ BL-UPLOAD | warning | new: backlinks.service.js | Heuristic: flag if > 50% of referring domains share no path/keyword overlap with target site topic (requires site topic tag in settings) |
| `press_coverage` | Press / PR Coverage | ⚠️ BL-UPLOAD | info | new: backlinks.service.js | Flag if no `link_type = pr` entries from recognized media domains in upload |
| `link_audit_frequency` | Link Audit Frequency | 📋 | info | — | Human: verify backlink audit performed at least quarterly |
| `social_signals` | Social Signals Correlation | 📋 | info | — | Human: verify high-traffic content is also earning links |
| `broken_link_opportunities` | Broken Link Building Opportunities | 📋 | info | — | Human: identify broken links on competitor sites targeting your content type |
| `resource_page_inclusion` | Resource Page Inclusion | 📋 | info | — | Human: verify inclusion in niche resource page compilations |
| `pillow_links_balance` | Pillow Links Balance | ⚠️ BL-UPLOAD | info | new: backlinks.service.js | Flag if no social profile or brand citation URLs present in upload |
| `link_building_velocity` | Link Building Velocity Target | 📋 | info | — | Human: verify defined link acquisition strategy with quality targets |

---

## Section 21 — E-E-A-T Signals

*Data source: `schema.js` (structured data); `links.js` (privacy/ToS detection); `content.js` (date detection)*

### 21a — General E-E-A-T

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `author_expertise` | Author Expertise Visible | ✅ | critical | content.js | On content pages (> 300 words): detect author presence — any of: `[rel="author"]`, `[itemprop="author"]`, class matching `/author|byline|writer/i`, text `/^by\s+[A-Z]/im`, or `author` field in Article/BlogPosting schema. Flag critical on YMYL-classified pages; flag warning on non-YMYL content pages. Pass if any signal detected |
| `author_links` | Author Links to Social/Profile | ✅ | warning | content.js | In detected author block (element with class `/author|byline|bio/i` or sibling of `[rel="author"]`): look for outbound `href` containing `linkedin.com`, `twitter.com`, `x.com`, `scholar.google.com`, `researchgate.net`. Flag if content page has author block but zero social/profile links |
| `about_page_quality` | About Page Quality | ✅ | warning | content.js | Check: (1) `/about` or `/about-us` returns 200 — flag if absent; (2) word count ≥ 200 — flag if thin; (3) page contains `Organization`/`Person` schema OR text patterns: person-name regex (`[A-Z][a-z]+ [A-Z][a-z]+` ≥ 2 occurrences), or trust keywords ("founded", "mission", "team", "certified", "licensed"). Flag warning if page exists but fails (2) or (3) |
| `contact_page_present` | Contact Page Present | ✅ | warning | links.js | Detect link to `/contact`, `/contact-us`, or page with contact form in site navigation |
| `physical_address` | Physical Address / Location | ✅ | warning | schema.js | Check for `PostalAddress` in `LocalBusiness` schema or visible address text pattern |
| `external_citations` | External Citations | ✅ | info | links.js | On content pages (> 400 words): count outbound links (different hostname). Flag info if zero external links on pages that show factual/data signals: headings with numbers, text matching "according to", "study shows", "data from", or `<cite>`/`<blockquote>` elements present. Skip on product/service/landing pages |
| `awards_credentials` | Industry Awards and Credentials | ✅ | info | content.js | On About page and homepage: detect trust/credential signals — text patterns: "award", "certified", "accredited", "ISO", "IRDAI", "SEBI", "recognised", "registered with", "licensed by", "approved by"; also `img[alt]` or `img[src]` matching these terms. Flag info if no signals found on About page |
| `user_reviews` | User Reviews and Testimonials | ✅ | info | schema.js | Check for `Review` or `AggregateRating` schema, or testimonial section in DOM |
| `wikipedia_presence` | Wikipedia / Knowledge Graph Presence | 📋 | info | — | Human: verify Google Knowledge Panel exists for brand |
| `expert_review` | Expert Review of Content | ✅ | warning | content.js | On content pages (> 300 words): detect reviewer attribution text — patterns: `/reviewed by/i`, `/medically reviewed/i`, `/fact.?checked by/i`, `/verified by/i`, `/approved by/i` followed by a name pattern. Flag warning if absent on content pages; flag critical if absent on YMYL-classified pages |
| `update_history_visible` | Content Update History Visible | ✅ | info | content.js | Detect visible "Last updated" date element or `<time>` tag on page |
| `privacy_policy_present` | Privacy Policy Present | ✅ | warning | links.js | Detect link to privacy policy in footer or navigation |
| `terms_of_service_present` | Terms of Service Present | ✅ | info | links.js | Detect link to ToS page in footer or navigation |
| `secure_payment_signals` | Secure Payment Signals | ✅ | warning | content.js | On pages with payment/purchase signals (form with `type="submit"` + price text, or checkout/buy URL patterns): detect: (1) trust badges — `img[alt]` or `img[src]` matching `/secure|ssl|lock|trust|verified|shield/i`; (2) payment logos — `img` matching `/visa|mastercard|rupay|paytm|razorpay|upi|amex/i`; (3) returns or refund link in page. Flag warning if any category absent |
| `author_schema_sameas` | Author Schema with sameAs | ✅ | info | schema.js | Check `author` property in schema includes `sameAs` array linking to social profiles |
| `press_mentions` | Press / Media Mentions | 📋 | info | — | Human: verify recognized publications have covered the brand |
| `brand_sentiment` | Positive Brand Sentiment | 📋 | warning | — | Human: verify no significant volume of negative reviews or brand reputation issues |
| `forum_community` | Forum and Community Presence | 📋 | info | — | Human: verify presence on Reddit, Quora, or niche forums |
| `org_structured_data` | Structured Data for Organization | ✅ | info | schema.js | Homepage must have `Organization` or `WebSite` schema with `logo`, `sameAs`, `url` |
| `brand_consistency` | Consistency of Brand Identity | 📋 | info | — | Human: verify consistent brand name, logo, and description across all platforms |
| `ymyl_review` | YMYL Content Medical/Financial Review | ✅ | critical | content.js | On YMYL-classified pages: detect expert reviewer credit — same patterns as `expert_review` PLUS credential markers in reviewer text: `CFP`, `CFA`, `CAIIB`, `Dr\.`, `MBBS`, `CA\b`, `LLB`, `IRDAI licensed`, `SEBI registered`. Flag critical if no reviewer credit found. Pass silently on non-YMYL pages |
| `transparent_methodology` | Transparent Methodology | ✅ | info | content.js | On pages with data signals (tables, `<canvas>`, statistical text matching `/\d+%|\d+ (lakh|crore|million)|survey of \d+/i`): detect methodology disclosure — text patterns: "methodology", "how we calculate", "how we rank", "data source", "based on data from", "our research process". Flag info if data-heavy page has no methodology disclosure |

---

### 21b — YMYL Automated Checks

> **YMYL page detection (shared logic for all three checks below):** A page is classified as YMYL if its URL path contains any of: `/insurance`, `/health`, `/investment`, `/loan`, `/finance`, `/policy`, `/premium`, `/medical`, `/legal`, `/compare` — OR if its extracted body text contains ≥ 3 occurrences of YMYL-signal words: "premium", "policy", "coverage", "claim", "sum assured", "deductible", "nominee", "maturity", "annuity", "interest rate". This classification is stored as page-level metadata — not itself a pass/fail check. Sites where no pages are classified as YMYL will silently pass all three checks below.

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `author_credentials_schema` | Author Credentials in Schema | ✅ | warning | schema.js | On pages with `Article`/`BlogPosting`/`NewsArticle` schema: verify `author` Person object includes `jobTitle` OR `honorificPrefix` (e.g. "Dr.", "CFP", "CFA", "CAIIB"). Presence of credential signals Google the author has verified expertise. Flag if author has `name` but zero credential fields. Severity upgrades to `critical` on YMYL-classified pages |
| `ymyl_disclaimer_present` | Regulatory Disclaimer on YMYL Pages | ✅ | critical | content.js | On YMYL-classified pages: detect at least one regulatory disclaimer signal in body text — regex patterns: IRDAI registration (`/IRDA[I]?\s*Reg\.?\s*No\.?\s*\d+/i`), SEBI registration (`/SEBI\s*Reg\.?\s*No/i`), "insurance is subject to terms", "read policy document carefully", "licensed broker", "not financial advice", "consult a financial advisor". Configurable per-site via additional regex patterns in settings. Flag if no pattern matched |
| `ymyl_date_disclosure` | Date Disclosure on YMYL Pages | ✅ | critical | content.js | On YMYL-classified pages: detect visible date signal — `article:published_time` or `article:modified_time` meta, `<time>` element with `datetime` attribute, or body text matching "last updated", "reviewed on", "effective from", "as of [month year]". Financial content must be dateable; undated financial claims mislead users. Flag if no date signal detected |
| `ymyl_outbound_authority` | Authority Links on YMYL Pages | ✅ | info | links.js | On YMYL-classified pages: verify at least one outbound link matches a recognised authority domain. Two-layer detection: **(1) Auto-regex** — hostname ends in `.gov`, `.gov.XX` (`.gov.in`, `.gov.uk`, `.gov.au`, `.gov.ae`, `.gc.ca`, `.govt.nz`), or `.edu`. Covers most government domains globally including UAE (`ia.gov.ae`, `sca.gov.ae`, `doh.gov.ae`). **(2) Site-configurable trusted list** stored in site settings — for official domains that do not use a `.gov` pattern: India: `irdai.gov.in`, `rbi.org.in`; UAE: `centralbank.ae`, `dfsa.ae`, `adgm.com`; UK: `fca.org.uk`; US: `sec.gov`, `ftc.gov`; any custom domain. Flag if zero links match either layer. Silently pass if YMYL page word count < 200 |

---

## Section 22 — AI Overviews & AIO Optimization

*Data source: `content.js`, `schema.js`, `headings.js` (existing); AI checks via `ai.service.js`*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `aio_passage_clarity` | Passage-Level Clarity | 🤖 | critical | ai.service.js | AI: verify each H2 section contains a self-contained answer that makes sense without surrounding context |
| `aio_summary_paragraph` | Definition / Summary Paragraph | 🤖 | critical | ai.service.js | AI: verify first 2–3 sentences define topic or answer the primary question directly |
| `aio_qa_format` | Question-Answer Format Content | ✅ | warning | headings.js | Check if H2s or H3s contain question marks; flag if fewer than 2 question-format headings on informational pages |
| `aio_factual_accuracy` | Factual Accuracy and Verifiability | 📋 | critical | — | Human: verify all factual claims are backed by cited sources |
| `aio_schema_ai_readability` | Schema Markup for AI Readability | ✅ | warning | schema.js | Check for `Article`, `FAQ`, `HowTo`, or `speakable` schema; flag if none present |
| `aio_content_freshness` | Content Freshness for AI | ✅ | warning | content.js | Same as `content_freshness`; flag if last modified > 6 months on fast-changing topics |
| `aio_cited_by_ai` | Cited by AI Chatbots | 📋 | info | — | Human: quarterly audit — verify brand appears in ChatGPT / Perplexity / Gemini responses |
| `aio_authoritative_tone` | Authoritative Tone | 🤖 | warning | ai.service.js | AI: flag excessive hedging language ("it depends", "might", "could possibly") without supporting evidence |
| `aio_concise_answers` | Concise Answers Before Detail | 🤖 | warning | ai.service.js | AI: verify direct answer given in first sentence of each section before elaboration |
| `aio_longtail_coverage` | Long-Tail Question Coverage | ✅ | info | headings.js | Count question-format headings; flag informational pages with fewer than 3 question headings |
| `aio_speakable` | Speakable Schema | ✅ | info | schema.js | Flag authoritative answer content without `speakable` property |
| `aio_training_data` | Content in AI Training Data Sources | 📋 | info | — | Human: verify content is cited or syndicated on Wikipedia / major publications |
| `aio_toc_anchors` | Table of Contents with Anchors | ✅ | info | content.js | Flag long-form pages (> 1,500 words) without a table of contents with anchor links |
| `aio_featured_snippet` | Featured Snippet Optimization | ⚠️ GSC | warning | gsc.js | Flag pages ranking position 1–3 in GSC but not holding featured snippet for their primary query |
| `aio_entities` | Entities and NLP Clarity | 🤖 | warning | ai.service.js | AI: flag ambiguous pronoun references or unnamed entities that NLP parsers cannot resolve |
| `aio_unique_insights` | Unique Insights Not Found Elsewhere | 🤖 | info | ai.service.js | AI: verify content contains perspective or data not commonly found on the topic |
| `aio_negative_impact` | Negative AIO Impact Mitigation | 📋 | info | — | Human: review whether FAQ / knowledge content strategy accounts for zero-click AIO impact |
| `aio_nlp_structure` | NLP-Friendly Content Structure | ✅ | warning | headings.js | Check semantic HTML: H2/H3 structure matches content purpose; flag flat unstructured text blocks > 500 words |
| `aio_content_length` | Content Length for Coverage | ✅ | info | content.js | Flag informational pages with < 800 words where topic depth warrants comprehensive coverage |

---

## Section 23 — GEO & LLM Crawlers

*Data source: new `robots.js` (llms.txt, AI directives); `meta.js` (OG tags); `canonical.js` (canonical); `jsrender.js` (raw HTML check)*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `geo_llms_txt` | LLMs.txt File Present | ✅ | info | new: robots.js | `GET /llms.txt` returns 200; fetch and store content |
| `geo_llms_full_txt` | LLMs-Full.txt File Present | ✅ | info | new: robots.js | `GET /llms-full.txt` returns 200; companion to llms.txt per Jeremy Howard spec — contains expanded machine-readable content index. Pass if returns 200; fail silently as info (not all sites need it, but presence is a positive GEO signal) |
| `geo_llms_txt_quality` | LLMs.txt Structure Quality | ✅ | warning | new: robots.js | Parse stored llms.txt text (skip if `geo_llms_txt` failed). Check: (1) has a site description paragraph before first link, (2) all link entries have human-readable labels, (3) at least 3 links present, (4) no raw query-string or session URLs. Flag warning per failing criterion. No Claude required — pure structural parsing |
| `geo_url_md_endpoint` | URL-Level Markdown Endpoint Accessible | ✅ | warning | new: robots.js | For a sample of 5 crawled content pages, attempt `GET <url>.md` or `GET <url>.md.txt`; pass if ≥ 1 responds 200 with non-HTML content. Signals LLM-friendly raw content endpoints (per emerging `/url.md` convention — e.g. `developers.google.com/search/docs/.../faqpage.md.txt`). Flag as warning if site has > 20 content pages and none have `.md` variants. Skip on e-commerce/local pages (only on blog/docs/article URL patterns) |
| `geo_ai_bot_robots` | AI Bot Access in Robots.txt | ✅ | warning | new: robots.js | Check for explicit `Allow` or `Disallow` for `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended` |
| `geo_google_extended` | Google-Extended Directive | ✅ | info | new: robots.js | Check for explicit rule for `Google-Extended` (controls Gemini AI training) |
| `geo_content_without_js` | Content Available Without JS for AI | ✅ | critical | new: jsrender.js | Key content (H1, main body, internal links) must exist in raw HTML; most AI crawlers are not JS-capable |
| `geo_topical_authority` | Topical Authority Signals for AI | 📋 | warning | — | Human: verify site is cited by AI tools on target topic cluster; monitor quarterly |
| `geo_brand_entity` | Brand Entity in AI Knowledge Bases | 📋 | info | — | Human: verify brand appears in Wikidata, Wikipedia, or Google Knowledge Graph |
| `geo_ai_platform_presence` | Content on AI-Indexed Platforms | 📋 | info | — | Human: verify content presence on Reddit, Quora, Stack Overflow, or Wikipedia |
| `geo_crawlable_pagination` | Crawlable Pagination | ✅ | info | links.js | Flag pages using infinite scroll with no numbered URL pagination; AI crawlers cannot trigger JS scroll |
| `geo_faq_html` | Structured FAQs Accessible to AI | ✅ | warning | content.js | FAQ answers must be in raw HTML; flag if FAQ content only renders after JS execution |
| `geo_canonical_dedup` | Canonical URL for AI Deduplication | ✅ | warning | canonical.js | Self-referencing canonical must be present on all content pages; AI crawlers use canonical for deduplication |
| `geo_og_tags` | Open Graph Tags for Social AI | ✅ | info | meta.js | `og:title`, `og:description`, `og:image` must be present on all pages |
| `geo_content_depth` | Content Depth on Single URL | 🤖 | warning | ai.service.js | AI: flag topic split across many thin pages where comprehensive coverage on single URL would be stronger |
| `geo_https_trust` | HTTPS for AI Crawler Trust | ✅ | critical | response.js | All content must be on HTTPS; AI crawlers follow security best practices |
| `geo_licensing_policy` | Content Licensing / Usage Policy | ✅ | info | content.js | Fetch `/terms`, `/terms-of-use`, or `/terms-and-conditions` (use crawled page if available; else HEAD + GET). Search text for AI/training consent signals: `/artificial intelligence|AI training|machine learning|automated (scraping|training)|LLM|large language model|data scraping/i`. Pass if any signal found (either permitting or restricting — explicit policy is the signal). Flag info if ToS page has none of these patterns |
| `geo_citation_audit` | Perplexity / ChatGPT Citation Audit | 📋 | info | — | Human: quarterly audit — track brand citation frequency in AI assistant responses |

---

## Section 24 — Local SEO & GEO

*Data source: `schema.js` (LocalBusiness schema); `response.js` (page crawlability); new schema geo coordinates check*

| check_id | Name | Feasibility | Severity | Covered By | Implementation Notes |
|---|---|---|---|---|---|
| `local_gbp_exists` | Google Business Profile Exists | 📋 | critical | — | Human: verify GBP listing claimed and verified for each business location |
| `local_gbp_category` | GBP Category Accuracy | 📋 | critical | — | Human: verify primary GBP category is most specific accurate match for business type |
| `local_nap_consistency` | NAP Consistency (Name/Address/Phone) | ✅ | critical | schema.js | **On-site automated:** Extract NAP from `LocalBusiness` schema (`name`, `address.streetAddress`, `address.addressLocality`, `telephone`). Compare to visible NAP text in footer and contact page using fuzzy match (Levenshtein distance ≤ 2). Flag critical if schema NAP differs from visible page NAP. Note in issue details: external consistency (GBP, directories) requires manual verification |
| `local_business_schema` | LocalBusiness Schema on Website | ✅ | critical | schema.js | `LocalBusiness` schema must include `name`, `address`, `telephone`, `openingHours` |
| `local_gbp_reviews_volume` | GBP Reviews (Volume) | 📋 | warning | — | Human: verify ≥ 25 Google reviews for established business |
| `local_gbp_reviews_rating` | GBP Reviews (Rating) | 📋 | critical | — | Human: verify average rating ≥ 4.0 stars |
| `local_review_response` | Review Response Rate | 📋 | warning | — | Human: verify > 80% of reviews have a business response |
| `local_gbp_photos` | GBP Photos Count and Quality | 📋 | info | — | Human: verify ≥ 10 high-quality photos with recent additions |
| `local_gbp_posts` | GBP Posts Active | 📋 | info | — | Human: verify GBP posts published at least monthly |
| `local_gbp_qa` | GBP Q&A Answered | 📋 | info | — | Human: verify all public GBP Q&A questions have business answers |
| `local_citation_count` | Citation Count | 📋 | warning | — | Human: verify business listed in ≥ 50 local directories |
| `local_citation_consistency` | Citation Consistency | 📋 | critical | — | Human: verify NAP matches GBP exactly across all citation sources |
| `local_location_page_quality` | Location Page Quality | ✅ | warning | content.js | Apply near-duplicate check filtered to location URL patterns (`/[city]/`, `/-[city]`, `/location/`, `/city-`). If 2+ location pages have > 80% content similarity (MinHash), flag as templated city-swap duplicate. Uses same MinHash logic as `near_duplicate` check |
| `local_location_crawlable` | Location Page Crawlable | ✅ | warning | response.js | All location pages must return 200 and be indexable (not noindexed or blocked) |
| `local_google_map_embedded` | Embedded Google Map on Location Page | ✅ | info | content.js | Detect Google Maps `<iframe>` embed on contact/location pages |
| `local_phone_number` | Local Phone Number (not 800) | ✅ | info | content.js | Extract phone numbers from `LocalBusiness` schema `telephone` and visible page text. Detect toll-free patterns: `/1800[-\s]\d{3}[-\s]\d{4}/`, `/0800[-\s]\d+/`. Detect local numbers: Indian mobile `/(\+91[-\s]?)?[6-9]\d{9}/`, local landline `/0\d{2,4}[-\s]\d{6,8}/`. Flag info if only toll-free detected with no local number. Skip if no phone numbers found at all |
| `local_service_area` | Service Area Defined in GBP | 📋 | info | — | Human: verify service area business has service area defined in GBP |
| `local_review_diversity` | Review Diversity Across Platforms | 📋 | info | — | Human: verify reviews on Google + at least one of Yelp/TripAdvisor/industry platforms |
| `local_opening_hours` | Opening Hours Accuracy | 📋 | warning | — | Human: verify business hours current in GBP including holiday hours |
| `local_content_marketing` | Local Content Marketing | 📋 | info | — | Human: verify locally relevant content (events, community topics) published regularly |
| `local_backlinks` | Local Backlinks | 📋 | warning | — | Human: verify links from local news, chambers of commerce, or local associations |
| `local_competitor_gbp` | Competitor GBP Comparison | 📋 | info | — | Human: regular review of competitor GBP profiles for gap identification |
| `local_geo_keywords` | Geo-Modified Keywords on Page | ⚠️ KW-UPLOAD | warning | content.js | Check location keywords from keyword mapping appear in title, H1, and body of location pages |
| `local_schema_geo` | Schema Geo Coordinates | ✅ | info | schema.js | `LocalBusiness` schema must include `geo` with `latitude` and `longitude` |
| `local_multiple_locations` | Multiple Locations Management | 📋 | info | — | Human: each location must have unique GBP listing, page, and schema |

---

## AI Checks — On-Demand Only

*All 🤖. Never auto-run during crawl. Triggered from Issues panel per page or bulk from dashboard.*
*Source: auditai check-catalog v1.1 — adapted for current platform's `ai.service.js` + SQLite storage.*

| check_id | Name | Input | Key Output Fields |
|---|---|---|---|
| `ai_content_quality` | Content Quality Audit | Extracted page text (strip nav/header/footer/aside) | `content_score` (0–100), `issues[]`, `suggestions[]`, `readability_level`, `eeat_signals[]`, `missing_eeat[]` |
| `ai_competitor_gap` | Competitor Gap Analysis | H1 + title + SerpAPI top-5 URLs | `missing_topics[]`, `missing_entities[]`, `content_length_gap`, `heading_gaps[]`, `content_gap_score` — **Requires `SERPAPI_KEY` in settings; skip gracefully if absent** |
| `ai_intent_classification` | Intent Classification | Page text + title + URL | `intent` (informational / transactional / navigational / commercial), `confidence`, `intent_mismatch`, `mismatch_detail` |
| `ai_entity_coverage` | Entity Coverage | Extracted page text | `entities_found[]`, `entities_missing[]`, `topic_clusters[]`, `entity_score` (0–100) |
| `ai_meta_optimisation` | Meta Optimisation | Title + description + H1 + first 200 words | `suggested_title`, `suggested_description`, `current_title_issues[]`, `current_desc_issues[]` |
| `ai_content_structure` | Content Structure Audit | Full heading hierarchy + page text | `structure_score`, `issues[]{issue, impact, location}`, `missing_sections[]`, `heading_suggestions[]` |
| `ai_internal_linking` | Internal Linking Suggestions | Current page URL + all crawled page titles + URLs | `suggestions[]{source_url, target_url, anchor_text, reason}` — **Requires full crawl to be complete first** |
| `ai_cannibalization` | Cannibalization Detection (AI layer) | All crawled page titles + H1s | `competing_pages[]{url_a, url_b, similarity_score, competing_intent, recommendation}` — Extends `cannibalization_gsc` |
| `ai_fix_generator` | Fix Generator | All failed check results for a page | `fixes[]{check_id, priority, specific_action, expected_impact, effort}` — Runs after other checks; generates specific not generic fixes |
| `ai_content_refresh` | Content Refresh Detection | Page text + publication date | `refresh_needed`, `staleness_score`, `outdated_elements[]{element, issue, suggestion}` |
| `ai_brand_voice` | Brand Voice Consistency | Multiple pages from same site (section-level, not per-page) | `consistency_score`, `tone_detected`, `deviations[]{url, deviation}` |
| `ai_composite_score` | Composite Content Score | Results from `ai_content_quality`, `ai_intent_classification`, `ai_entity_coverage`, `ai_content_structure` | `final_score` = (content_quality × 0.40) + (intent_match × 0.30) + (entity_coverage × 0.30) |
| `ai_serp_opportunities` | SERP Feature Opportunities | H1 + headings + schema + SerpAPI | `opportunities[]{feature, likelihood, requirement, competitor_has_it}` — **Requires `SERPAPI_KEY`** |
| `ai_content_freshness_detect` | Content Refresh Detection (AI layer) | Page text + date signals | Extended version of `content_freshness` — AI identifies specific outdated elements (prices, stats, events) |
| `ai_author_topic_match` | Author Credential–Topic Alignment | Author bio text (from linked author profile page or schema `description`) + page title + H1 + first 300 words | `match_score` (0–100), `author_expertise_signals[]` (qualifications detected in bio), `topic_signals[]` (expertise required by page content), `aligned` (boolean), `mismatch_reason` — **YMYL pages only**: flag if author has no detectable expertise signal matching the page topic (e.g. "CFP" bio but page is about health insurance, or generic bio on a tax advice page). Pass silently if no author bio is linked or YMYL page classification not triggered |

**Content extraction rule for all AI checks:** Strip `nav`, `header`, `footer`, `aside`, `script`, `style`, `[class*="ad"]` before any LLM call. Never send raw HTML to Claude. Truncate at 12,000 characters by default.

---

## Scoring Model

Deduction model — computed post-crawl per page and per section.

```js
// backend/services/scoring.service.js
const WEIGHTS = { critical: 25, warning: 10, info: 1 }

function computePageScore(checkResults) {
  const deductions = checkResults
    .filter(r => !r.passed)
    .reduce((sum, r) => sum + (WEIGHTS[r.severity] ?? 0), 0)
  return Math.max(0, 100 - deductions)
}

function computeSectionScore(checkResults, section) {
  return computePageScore(checkResults.filter(r => r.section === section))
}
```

Every check must return a `CheckResult` object:
```js
{
  check_id: string,       // matches check_id in this catalog
  passed: boolean,
  severity: 'critical' | 'warning' | 'info',
  section: string,        // section name from this catalog
  message: string,        // human-readable result summary
  details: string|null    // optional: specific URL, value, or element that failed
}
```

---

## Extractor Map — What Needs to Be Built

| File | Status | Sections It Serves |
|---|---|---|
| `playwright-crawler/src/extractors/response.js` | **exists** | 1, 3, 5, 8, 9, 23 |
| `playwright-crawler/src/extractors/canonical.js` | **exists** | 2, 18 |
| `playwright-crawler/src/extractors/meta.js` | **exists** | 8, 11, 12 |
| `playwright-crawler/src/extractors/headings.js` | **exists** | 13 |
| `playwright-crawler/src/extractors/links.js` | **exists** | 5, 17, 21 |
| `playwright-crawler/src/extractors/images.js` | **exists** | 15 |
| `playwright-crawler/src/extractors/content.js` | **exists** | 5, 14, 22 |
| `playwright-crawler/src/extractors/schema.js` | **exists** | 16, 21, 24 |
| `playwright-crawler/src/extractors/resources.js` | **exists** | 10 |
| `playwright-crawler/src/extractors/robots.js` | **new (site-level)** | 3, 4, 23 |
| `playwright-crawler/src/extractors/sitemap.js` | **new (site-level)** | 4 |
| `playwright-crawler/src/extractors/jsrender.js` | **new** | 7, 23 |
| `playwright-crawler/src/extractors/mobile.js` | **new** | 8 |
| `playwright-crawler/src/extractors/monitoring.js` | **new** | 9, 10 |
| `playwright-crawler/src/extractors/url.js` | **new** | 5, 6 |
| `backend/services/crux.js` | **new** | 10 |
| `backend/services/backlinks.service.js` | **new** | 20 |
| `backend/services/scoring.service.js` | **new** | all |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-07 | Initial catalog — 341 checks across 24 sections + 14 AI checks. Sources: `audit-replan-subchecks-comprehensive.csv` (321 checks) + auditai v1.1 check-catalog (AI checks, JS SEO reclassifications). Adds ⚠️ KW-UPLOAD and ⚠️ BL-UPLOAD feasibility tiers. |
| v1.1 | 2026-05-07 | Feasibility audit: 9 corrections. Added ⚠️ GA4 tier to key. Fixed labels: `title_brand` (KW-UPLOAD→✅), `ga4_connected` (GSC→GA4), `schema_author` (📋→✅), `img_schema` (📋→✅), `news_sitemap` (📋→✅), `content_language_match` (📋→✅ via `franc-min`). Removed duplicate `schema_speakable` (kept in S22 as `aio_speakable`). Corrected `img_format` note. Added MinHash scalability note to `near_duplicate`. Total: 341→340 checks; ✅ 184→188; 📋 72→68. |
| v1.2 | 2026-05-07 | Scraped SEO Automation schema system. Added `schema_rules` check (URL glob pattern → required @type mapping, user-configurable). Split Section 16 into 16a (Schema Rules) and 16b (Heuristic checks). Added 16 predefined types list, personalised/custom schema type support, Schema Rules Editor UI requirement, and new `schema_rules` SQLite table spec. Total: 340→341; ✅ 188→189. |
| v1.3 | 2026-05-07 | PolicyBazaar context. Removed Cars24-specific schema examples; replaced with insurance/finance schema types (`InsuranceAgency`, `FinancialProduct`, `HealthInsurancePlan`, `MotorInsurance`, `TermInsurance`). Split Section 21 into 21a (General E-E-A-T) and 21b (YMYL Automated). Added 3 new YMYL checks: `ymyl_disclaimer_present` (critical — IRDAI/SEBI disclaimer regex, site-configurable), `ymyl_date_disclosure` (critical — date visibility on financial pages), `ymyl_outbound_authority` (info — international: any `.gov`/`.gov.XX`/`.edu` + configurable site-level trusted domains). Total: 341→344; ✅ 189→192. |
| v1.4 | 2026-05-07 | Author credential checks. Added `author_credentials_schema` (✅ warning → critical on YMYL: `author.jobTitle` or `author.honorificPrefix` required in Article schema). Added `ai_author_topic_match` (🤖: AI compares author bio expertise signals to page topic; YMYL pages only). Total: 344→346; ✅ 192→193; 🤖 28→29. |
| v1.5 | 2026-05-07 | LLM discoverability checks. Added `geo_llms_full_txt` (✅ info), `geo_llms_txt_quality` (✅ warning: structural parse), `geo_url_md_endpoint` (✅ warning: `.md`/`.md.txt` probe). Total: 346→349; ✅ 193→196; 🤖 29→29. |
| v1.6 | 2026-05-07 | Playwright/HTTP automation audit. 20 checks reclassified: 18 📋→✅ (DOM/regex/HTTP achievable without external APIs), 2 🤖→✅ (`meta_desc_cta` and `img_alt_descriptive` are pure regex). Checks converted: `subdomain_vs_subfolder`, `app_install_banners`, `meta_desc_cta`, `expert_attribution`, `img_alt_descriptive`, `intl_url_strategy`, `locale_formatting`, `author_expertise`, `author_links`, `about_page_quality`, `external_citations`, `awards_credentials`, `expert_review`, `secure_payment_signals`, `ymyl_review`, `transparent_methodology`, `geo_licensing_policy`, `local_nap_consistency`, `local_location_page_quality`, `local_phone_number`. Total unchanged at 349; ✅ 196→216; 🤖 29→27; 📋 68→50. |
