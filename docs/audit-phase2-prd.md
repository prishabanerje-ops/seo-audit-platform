# Audit Phase 2 — Full Check Registry Rebuild PRD

> **Branch:** `feature/audit-phase2`
> **Worktree:** `.worktrees/audit-phase2`
> **Status:** Migration written. Seed + downstream wiring pending.
> **Reference CSV:** `~/Downloads/audit-replan-subchecks-comprehensive.csv` (321 checks, 23 groups)

---

## 1. Problem Statement

The existing audit_checks table has 354 checks built up incrementally across multiple phases. They are:
- A mix of rule-phrased names ("Sitemap is valid XML format") and problem-phrased names ("Sitemap Parse Errors") with no consistent model
- Only ~70 of 354 checks are actually wired in the parser (emit audit_results rows)
- Categories don't match the new 23-group taxonomy approved by the product owner
- No `issue_name` field, so the UI can't distinguish "what we check" from "what the problem is"

---

## 2. Solution: Two-Field Model + Clean Rebuild

### Core concept
Every check has two names:
- `name` — the **rule statement** shown in the check registry ("Title Tag Present")
- `issue_name` — the **problem statement** shown on failing findings ("Missing Title Tag")

The parser emits `issueType` strings that match `issue_name` values. `reports.js` joins on `WHERE name = ? OR issue_name = ?` so both lookup paths work.

### Three result statuses
| Status | Storage | Meaning |
|--------|---------|---------|
| ✅ Pass | NOT stored | No failure row = pass |
| ❌ Fail | Stored in `audit_results` | `issueType` matches `issue_name` |
| ⚫ Grey | NOT stored | Manual check — crawler can't detect |

Grey checks exist only as definitions in `audit_checks`. They are rendered in the UI as locked/greyed with no DB rows.

---

## 3. New Check Taxonomy (23 Groups, 321 Checks)

| # | Group | Count | Type |
|---|-------|-------|------|
| 1 | Response Codes & Redirects | 10 | Automated |
| 2 | Canonicalisation | 10 | Automated |
| 3 | Robots & Crawl Directives | 10 | Automated |
| 4 | XML Sitemaps | 15 | Automated |
| 5 | Crawlability & Indexability | 10 | Automated |
| 6 | URL Structure | 10 | Automated |
| 7 | JavaScript Rendering | 10 | Mix |
| 8 | Mobile & Usability | 11 | Automated |
| 9 | Security & HTTPS | 11 | Automated |
| 10 | Core Web Vitals | 10 | Automated |
| 11 | Title Tags | 10 | Automated |
| 12 | Meta Descriptions | 10 | Automated |
| 13 | Headings | 10 | Automated |
| 14 | Content Quality | 15 | Mix |
| 15 | Images | 14 | Mix |
| 16 | Schema & Structured Data | 16 | Mix |
| 17 | Internal Linking | 10 | Automated |
| 18 | International SEO | 10 | Mix |
| 19 | Rankings & Traffic | 13 | Manual |
| 20 | Backlinks & Authority | 25 | Manual |
| 21 | E-E-A-T Signals | 22 | Manual |
| 22 | AI Overviews & AIO Optimization | 19 | Mix |
| 23 | GEO & LLM Crawlers | 15 | Mix |
| 24 | Local SEO & GEO | 25 | Mix |

**Total: 321 checks**

Full check list with thresholds, pass/fail conditions, and automation type:
→ `~/Downloads/audit-replan-subchecks-comprehensive.csv`

---

## 4. Schema Changes

### 4a. Migration 018 (already written)
File: `backend/db/migrations/018_audit_checks_rebuild.js`

```sql
ALTER TABLE audit_checks ADD COLUMN issue_name TEXT;
UPDATE ai_suggestions SET check_id = NULL WHERE check_id IS NOT NULL;
DELETE FROM audit_checks;
```

Adds `issue_name`, detaches old AI suggestion links, clears all old check rows.

### 4b. audit_checks table after migration
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| check_number | INTEGER UNIQUE | 1–321 |
| name | TEXT | Rule statement ("Title Tag Present") |
| issue_name | TEXT | Problem statement ("Missing Title Tag") |
| category | TEXT | One of 23 groups above |
| subsection | TEXT | Sub-area within category |
| description | TEXT | Threshold logic / what is checked |
| seo_impact | TEXT | Why this matters for rankings |
| implementation_rule | TEXT | Detection pseudocode |
| logic_summary | TEXT | Optional human-readable logic |
| severity_default | TEXT | 'critical' / 'warning' / 'info' |
| is_automated | INTEGER | 1 = automated, 0 = manual |
| automation_type | TEXT | 'automated' / 'manual' / 'hybrid' |
| tool_current | TEXT | Which tool currently detects this |
| tool_future | TEXT | Planned detection tool |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 5. Implementation Plan

### Step 1: Seed File Rebuild
**File:** `backend/db/seed/audit-checks.js`

Replace the entire file. The new seed must:
- Export `AUDIT_CHECKS` array with exactly 321 entries
- Export `seedAuditChecks(db)` function using `INSERT OR IGNORE INTO audit_checks` (idempotent)
- Return count of rows inserted (0 = already seeded, 321 = fresh seed)

Each entry in `AUDIT_CHECKS`:
```js
{
  check_number: 1,
  name: 'Title Tag Present',         // rule statement
  issue_name: 'Missing Title Tag',   // problem statement (matches parser issueType)
  category: 'Title Tags',
  subsection: 'Presence',
  description: 'Title tag exists on every indexable page',
  seo_impact: 'Missing title = no SERP headline; critical ranking signal',
  implementation_rule: 'Check <title> element exists and is non-empty in DOM',
  severity_default: 'critical',
  is_automated: 1,
  automation_type: 'automated',
}
```

**Source:** Use `~/Downloads/audit-replan-subchecks-comprehensive.csv` for all 321 entries.
The `issue_name` for each check is the problem-phrased version — see mapping in Section 6 below.

### Step 2: Update Seed Test
**File:** `backend/__tests__/audit-checks-seed.test.js`

Update:
- `expect(AUDIT_CHECKS).toHaveLength(321)` (was 354)
- `expect(cnt).toBe(321)` (both count test and idempotency test)
- Expected categories list: the 23 groups above (NOT the old 19)
- `expect(actual.size).toBe(23)` (was 19... actually 24 rows in CSV but 23 unique groups — verify)

### Step 3: Update reports.js Join
**File:** `backend/routes/reports.js` — line 44-48

Change from:
```js
WHERE name = ?
```
To:
```js
WHERE name = ? OR issue_name = ?
```
And pass `result.issue_type` as both bind parameters:
```js
.get(result.issue_type, result.issue_type)
```

### Step 4: Update Parser issueType Strings
**File:** `backend/services/audit-parser.service.js`

The parser currently emits `issueType` strings. These must match the `issue_name` values in the new seed. Key mappings (old issueType → new issue_name in seed):

| Parser issueType (current) | New issue_name in seed |
|---------------------------|------------------------|
| Missing Title Tag | Missing Title Tag ✅ (unchanged) |
| Duplicate Title Tag | Duplicate Title Tag ✅ |
| Title Too Short | Title Tag Wrong Length |
| Title Too Long | Title Tag Wrong Length |
| Missing Meta Description | Missing Meta Description ✅ |
| Duplicate Meta Description | Duplicate Meta Description ✅ |
| Missing H1 | Missing H1 Tag |
| Multiple H1 Tags | Missing H1 Tag (or add separate check) |
| Missing Alt Text | Images Missing Alt Text |
| Broken Internal Link | Broken Internal Link ✅ |
| Orphan Page (0 Inlinks) | Orphan Page (0 Inlinks) ✅ |
| Too Many Outlinks (>100) | Too Many Outlinks (>100) ✅ |
| Missing Robots.txt | Missing Robots.txt ✅ |
| Sitemap Parse Errors | Sitemap Parse Errors ✅ |
| Missing Sitemap.xml | Missing Sitemap.xml ✅ |
| Sitemap Too Large (>50k URLs) | Sitemap Too Large (>50k URLs) ✅ |
| Missing Viewport Meta Tag | Missing Viewport Meta Tag ✅ |
| No Analytics Tag Detected | No Analytics Tag Detected ✅ |
| GA4 Double Firing Detected | GA4 Double Firing Detected ✅ |
| Critical Content Only in JS | Critical Content Only in JS ✅ |
| Hreflang Missing x-default | Hreflang Missing x-default ✅ |
| Sitemap Not Declared in Robots.txt | Sitemap Not Declared in Robots.txt ✅ |

Most existing parser strings already match the new `issue_name` values. Verify after seed is written.

### Step 5: Frontend Category Updates
**File:** `frontend/src/components/audit/auditCategories.js` (or equivalent)

Update category list from 19 old groups to 23 new groups. Each category needs:
- `id` slug
- `label` display name
- `icon` (pick from existing icon set)
- Route registration in `router.jsx`

### Step 6: AuditCategory.jsx
The category detail page must handle:
- **Automated checks with failures** → show failing URLs from `audit_results`
- **Manual checks (grey)** → render as locked with info tooltip: "This check requires manual review"
- **Automated checks with zero failures** → show "All checks passed" empty state

Grey check display: filter `audit_checks WHERE category = ? AND automation_type = 'manual'` and render separately in a "Manual Review Required" section.

---

## 6. Complete issue_name Mapping (name → issue_name)

This is the full mapping for all 321 checks. Use this when writing the seed.

### Response Codes & Redirects
| name | issue_name |
|------|-----------|
| 200 Status Code | Non-200 Status Code |
| 301 vs 302 Usage | 302 Used for Permanent Redirect |
| Redirect Chains | Redirect Chain Detected |
| Redirect Loops | Redirect Loop Detected |
| Redirect to HTTPS | HTTP Not Redirecting to HTTPS |
| 4xx Broken Pages | Broken Page (4xx) |
| 5xx Server Errors | Server Error (5xx) |
| Temporary Redirect Overuse | Long-Term 302 Redirect in Place |
| Redirect Count | Excessive Redirects |
| Gone vs Not Found | 404 Used for Permanently Deleted Content |

### Canonicalisation
| name | issue_name |
|------|-----------|
| Self-Referencing Canonical | Missing Self-Referencing Canonical |
| Duplicate Canonical Tags | Multiple Canonical Tags |
| Canonical Points to HTTPS | Canonical Points to HTTP URL |
| Canonical to 4xx or 5xx | Canonical Points to Error Page |
| Canonical Loops | Circular Canonical Chain |
| Reciprocal Canonicals | Non-Reciprocal Canonical |
| Trailing Slash Canonical | Inconsistent Trailing Slash in Canonical |
| Paginated Pages Canonical | Paginated Page Points to Page 1 |
| URL Parameter Handling | URL Parameters Not Canonicalized |
| Hreflang vs Canonical Conflict | Hreflang Contradicts Canonical |

### Robots & Crawl Directives
| name | issue_name |
|------|-----------|
| Robots.txt Exists | Missing Robots.txt |
| Robots.txt Valid Syntax | Robots.txt Syntax Error |
| Sitemap Declared in Robots.txt | Sitemap Not Declared in Robots.txt |
| Crawlable Resources Not Blocked | Render-Critical Resources Blocked |
| Sensitive Paths Blocked | Sensitive Paths Exposed |
| Important Pages Not Blocked | Important Pages Blocked by Robots.txt |
| Conflicting Directives | Conflicting Robots.txt Directives |
| AI Crawler Directives | No AI Crawler Policy in Robots.txt |
| Meta Noindex Not Contradicting Disallow | Noindex Page Blocked (Tag Unreadable) |
| Crawl-Delay Set If Needed | No Crawl-Delay on Resource-Constrained Server |

### XML Sitemaps
| name | issue_name |
|------|-----------|
| Sitemap Exists | Missing Sitemap.xml |
| Valid XML Format | Sitemap Parse Errors |
| Sitemap URL Count | Sitemap Too Large (>50k URLs) |
| Sitemap File Size | Sitemap File Too Large (>50MB) |
| Sitemap Index Used for Large Sites | No Sitemap Index for Large Site |
| Sitemap Declared in Robots.txt | Sitemap Not Declared in Robots.txt |
| No Blocked URLs in Sitemap | Blocked URLs in Sitemap |
| No 4xx/5xx URLs in Sitemap | Error URLs in Sitemap |
| No Redirect URLs in Sitemap | Redirect URLs in Sitemap |
| Orphan URLs in Sitemap | Orphan Pages Missing from Sitemap |
| Lastmod Accuracy | Inaccurate Lastmod Dates |
| Image Sitemap | Missing Image Sitemap |
| Video Sitemap | Missing Video Sitemap |
| Sitemap Submitted to GSC | Sitemap Not Submitted to GSC |
| News Sitemap | Missing News Sitemap |

### Crawlability & Indexability
| name | issue_name |
|------|-----------|
| Meta Noindex Used Correctly | Noindex on Important Page |
| X-Robots-Tag Header | Conflicting X-Robots-Tag Header |
| Crawl Depth | Page Too Deep to Crawl Efficiently |
| Orphan Pages | Orphan Page (0 Inlinks) |
| Soft 404 Detection | Soft 404 Detected |
| Session IDs in URLs | Session IDs in URL |
| Crawl Trap / Infinite Parameters | Crawl Trap Detected |
| URL Parameters Handled | Unhandled URL Parameters Creating Duplicates |
| Nofollow Internal Links | Excessive Internal Nofollow |
| Noindex on Paginated Pages | Inconsistent Pagination Noindex |

### URL Structure
| name | issue_name |
|------|-----------|
| URL Length | URL Too Long |
| Lowercase Characters | Uppercase Characters in URL |
| Hyphen Word Separators | Underscores Used as URL Separators |
| Special Characters in Slug | Special Characters in URL |
| Keyword in URL | No Keyword in URL Slug |
| Descriptive URL Slugs | Non-Descriptive URL Slug |
| Trailing Slash Consistency | Inconsistent Trailing Slash |
| Deep Nesting | Excessive URL Depth |
| Subdomain vs Subfolder | Content on Subdomain Instead of Subfolder |
| Date Format in URLs | Inconsistent Date Format in URL |

### JavaScript Rendering
| name | issue_name |
|------|-----------|
| Critical Content in Raw HTML | Critical Content Only in JS |
| Metadata in Raw HTML | Meta Tags Only in JS |
| Link Discovery via JS | Links Only Discoverable via JS |
| Structured Data Rendering | Schema Only in JS-Rendered DOM |
| Render Comparison | Rendered Content Differs from Source HTML |
| CSR vs SSR | Full Client-Side Rendering Detected |
| Two-Wave Indexing Risk | Content at Risk of Two-Wave Indexing |
| Lazy-Loaded Content | Important Content Behind Lazy Load |
| JS Dependencies Load Order | Render-Blocking JS |
| Crawl Budget vs Rendering Time | Slow JS Rendering Impacting Crawl Budget |

### Mobile & Usability
| name | issue_name |
|------|-----------|
| Viewport Meta Tag | Missing Viewport Meta Tag |
| Mobile Responsiveness | Page Not Mobile Responsive |
| Tap Target Size | Tap Targets Too Small |
| Text Size Legibility | Text Too Small for Mobile |
| Horizontal Scroll | Horizontal Scroll on Mobile |
| Zoom Disabled | User Zoom Disabled |
| Interstitials on Mobile | Intrusive Mobile Interstitial |
| Content Parity Mobile vs Desktop | Mobile Content Missing vs Desktop |
| Touch Spacing | Tap Targets Too Close Together |
| Mobile Speed | Poor Mobile LCP |
| App Install Banners | Full-Page App Install Interstitial |

### Security & HTTPS
| name | issue_name |
|------|-----------|
| HTTPS Enabled | HTTP Pages Not Redirected to HTTPS |
| SSL Certificate Valid | Invalid SSL Certificate |
| SSL Certificate Chain Complete | Incomplete SSL Certificate Chain |
| HSTS Header | HSTS Header Missing or Weak |
| Content Security Policy | Missing Content Security Policy |
| X-Frame-Options | Missing X-Frame-Options Header |
| X-Content-Type-Options | Missing X-Content-Type-Options Header |
| Referrer-Policy | Missing Referrer-Policy Header |
| Mixed Content | Mixed Content Detected |
| Security Headers Grade | Poor Security Headers Grade |
| Permissions-Policy | Missing Permissions-Policy Header |

### Core Web Vitals
| name | issue_name |
|------|-----------|
| LCP (Largest Contentful Paint) | Poor LCP |
| INP (Interaction to Next Paint) | Poor INP |
| CLS (Cumulative Layout Shift) | High CLS Score |
| FCP (First Contentful Paint) | Poor FCP |
| TTFB (Time to First Byte) | Slow TTFB |
| Mobile CWV Performance | Poor Mobile Core Web Vitals |
| CWV Pass Rate | Low CWV Pass Rate |
| LCP Element Identification | Unoptimized LCP Element |
| CLS Causes | Layout Shift Causes Identified |
| CWV Trend Over Time | CWV Metrics Degrading |

### Title Tags
| name | issue_name |
|------|-----------|
| Title Tag Present | Missing Title Tag |
| Title Tag Unique | Duplicate Title Tag |
| Title Tag Length (Characters) | Title Tag Wrong Length |
| Title Tag Pixel Width | Title Tag Truncated in SERP |
| Primary Keyword in Title | Primary Keyword Missing from Title |
| Keyword Position in Title | Keyword Not Front-Loaded in Title |
| Brand in Title | Brand Missing from Title |
| Keyword Stuffing in Title | Keyword Stuffing in Title |
| Title Relevance to Content | Title Misleads About Page Content |
| Title vs H1 Differentiation | Title Identical to H1 |

### Meta Descriptions
| name | issue_name |
|------|-----------|
| Meta Description Present | Missing Meta Description |
| Meta Description Unique | Duplicate Meta Description |
| Meta Description Length (Characters) | Meta Description Wrong Length |
| Keyword in Description | Keyword Missing from Meta Description |
| Call-to-Action in Description | No Call-to-Action in Meta Description |
| Description Accuracy | Misleading Meta Description |
| Keyword Position in Description | Keyword Late in Meta Description |
| No HTML Tags in Description | HTML Tags in Meta Description |
| Special Character Encoding | Encoding Errors in Meta Description |
| Duplicate Auto-Generated Descriptions | Templated Meta Descriptions Detected |

### Headings
| name | issue_name |
|------|-----------|
| H1 Present | Missing H1 Tag |
| H1 Unique Across Site | Duplicate H1 Tag |
| H1 Content Relevance | H1 Irrelevant to Page Content |
| H1 Length | H1 Wrong Length |
| H2 Structure | Poor H2 Structure |
| Heading Hierarchy | Heading Hierarchy Skips Levels |
| H3-H6 Nesting Order | Out-of-Order Heading Levels |
| Keyword in H1 | Keyword Missing from H1 |
| Keyword in H2s | Keyword Missing from H2s |
| Keyword Stuffing in Headings | Keyword Stuffing in Headings |

### Content Quality
| name | issue_name |
|------|-----------|
| Minimum Word Count | Thin Content (<300 Words) |
| Cornerstone Content Word Count | Pillar Content Too Short |
| Thin Content Detection | Thin or Auto-Generated Content |
| Duplicate Content Internal | Internal Duplicate Content |
| Near-Duplicate Content | Near-Duplicate Content Detected |
| Keyword Density | Keyword Density Issues |
| Keyword Variations Used | No Keyword Variations in Content |
| Content Freshness | Outdated Content |
| Readability Score | Poor Content Readability |
| Original Research or Data | No Original Data or Research |
| Content Purpose Clarity | Unclear Content Purpose |
| Fact Checking | Unverifiable Claims in Content |
| Expert Attribution | No Author Attribution |
| Actionable Content | Non-Actionable Content |
| Content-Search Intent Match | Content Mismatches Search Intent |

### Images
| name | issue_name |
|------|-----------|
| Alt Text Present | Images Missing Alt Text |
| Alt Text Descriptive | Generic or Poor Alt Text |
| Decorative Image Handling | Decorative Image Missing Empty Alt |
| Image File Name | Non-Descriptive Image Filename |
| Image File Format | Outdated Image Format |
| Image File Size | Oversized Image File |
| Image Dimensions Declared | Missing Image Width/Height Attributes |
| Lazy Loading | Images Not Lazy Loaded |
| Responsive Images Srcset | No Srcset for Responsive Images |
| Image Compression Quality | Poor Image Compression |
| Width-Height Aspect Ratio | Distorted Image Aspect Ratio |
| Image Schema Markup | Missing Image Schema |
| Image Content Relevance | Irrelevant or Stock Images |
| Next-Gen Format Adoption | Legacy Image Format Used |

### Schema & Structured Data
| name | issue_name |
|------|-----------|
| Schema Markup Present | No Schema Markup |
| JSON-LD Format Used | Non-JSON-LD Schema Format |
| Schema Validation (Schema.org) | Invalid Schema Markup |
| Google Rich Results Eligibility | Schema Fails Rich Results Test |
| Article Schema | Missing Article Schema |
| Author Schema | Missing Author in Schema |
| Product Schema | Missing Product Schema |
| Review / Rating Schema | Ratings Without Schema |
| FAQ Schema | FAQ Content Without Schema |
| Breadcrumb Schema | Breadcrumbs Without Schema |
| LocalBusiness Schema | Missing LocalBusiness Schema |
| Video Schema | Video Without Schema |
| Event Schema | Event Info Without Schema |
| Organization Schema | Missing Organization Schema |
| HowTo Schema | How-To Content Without Schema |
| Speakable Schema | No Speakable Schema |

### Internal Linking
| name | issue_name |
|------|-----------|
| Internal Links Return 200 | Broken Internal Link |
| No Orphan Pages | Orphan Page (0 Inlinks) |
| Internal Link Count per Page | Too Many Outlinks (>100) |
| Crawl Depth | Page Too Deep (>3 Clicks) |
| Anchor Text Descriptiveness | Generic Anchor Text |
| Exact Match Anchor Overuse | Over-Optimized Anchor Text |
| Nofollow on Internal Links | Excessive Internal Nofollow Links |
| Links to Important Pages | Key Pages Under-Linked Internally |
| Broken Internal Links | Broken Internal Links Detected |
| Redirect Internal Links | Internal Links Pointing to Redirects |

### International SEO
| name | issue_name |
|------|-----------|
| Hreflang Tags Present | Missing Hreflang Tags |
| Hreflang Self-Reference | Hreflang Missing Self-Reference |
| Hreflang Reciprocal | Non-Reciprocal Hreflang |
| x-default Hreflang | Hreflang Missing x-default |
| Hreflang Language Code Validity | Invalid Hreflang Language Code |
| Hreflang URL Consistency | Inconsistent URLs in Hreflang |
| Alternate Language Pages Indexed | Language Alternate Page Not Indexed |
| Content Language Match | Content Language Mismatch with Hreflang |
| ccTLD vs Subdirectory Strategy | Inconsistent International URL Strategy |
| Currency / Date Localization | Incorrect Locale Formatting for Region |

### Rankings & Traffic
| name | issue_name |
|------|-----------|
| Google Search Console Connected | No Google Search Console Access |
| GA4 Connected | No Analytics Tag Detected |
| Keyword Rankings Tracked | No Keyword Tracking |
| Organic Traffic Trend | Declining Organic Traffic |
| Click-Through Rate (CTR) | Low Organic CTR |
| Average Position Trend | Declining Average SERP Position |
| Impressions Growth | Declining Search Impressions |
| Crawl Coverage in GSC | Indexing Coverage Issues Detected |
| Core Update Impact Detection | Core Update Traffic Drop Detected |
| Cannibalization Detection | Keyword Cannibalization Detected |
| Featured Snippet Presence | No Featured Snippets Captured |
| SERP Feature Presence | Rich Results Not Showing in SERP |
| Branded vs Non-Branded Split | Low Non-Branded Organic Traffic |

### Backlinks & Authority
| name | issue_name |
|------|-----------|
| Referring Domain Count | Low Referring Domain Count |
| Referring Domain Authority | Low-Authority Backlink Profile |
| Anchor Text Distribution | Unnatural Anchor Text Distribution |
| Toxic / Spammy Links | Toxic or Spammy Links Detected |
| Dofollow vs Nofollow Ratio | Unnatural Dofollow/Nofollow Ratio |
| Link Velocity | Unnatural Link Velocity |
| Lost Backlinks | Significant Lost Backlinks |
| Competitor Backlink Gap | Backlink Gap vs Competitors |
| Editorial Link vs Paid Link | Paid Links Without rel=sponsored |
| Link Diversity (Content Type) | Link Profile Lacks Diversity |
| Internal PageRank Distribution | Poor Internal PageRank Distribution |
| Domain Authority Trend | Declining Domain Authority |
| Homepage Link Concentration | Backlinks Concentrated on Homepage Only |
| Brand Mentions (Unlinked) | Unreclaimed Brand Mentions |
| Disavow File Status | No Disavow File for Toxic Links |
| Competitor Authority Score | Authority Below Competitor Benchmark |
| Link Building Velocity Target | No Active Link Building Strategy |
| Edu / Gov Links | No High-Trust Institutional Links |
| Social Signals Correlation | Social Traffic Not Converting to Links |
| Broken Link Building Opportunities | Competitor Broken Links Not Targeted |
| Niche Relevance of Links | Off-Topic Links in Profile |
| Press / PR Coverage | No Press or Media Coverage |
| Resource Page Inclusion | Not Listed on Niche Resource Pages |
| Pillow Links Balance | No Brand Citation Foundation |
| Link Audit Frequency | No Recent Backlink Audit |

### E-E-A-T Signals
| name | issue_name |
|------|-----------|
| Author Expertise Visible | No Author Attribution |
| Author Links to Social/Profile | Author Identity Not Verifiable |
| About Page Quality | Missing or Thin About Page |
| Contact Page Present | No Contact Information |
| Physical Address / Location | No Physical Address for YMYL Site |
| External Citations | No External Citations in Content |
| Industry Awards and Credentials | No Industry Recognition Signals |
| User Reviews and Testimonials | No Social Proof or Reviews |
| Wikipedia / Knowledge Graph Presence | Brand Not in Knowledge Graph |
| Expert Review of Content | YMYL Content Without Expert Review |
| Content Update History Visible | No Content Last-Updated Date |
| Privacy Policy Present | Missing Privacy Policy |
| Terms of Service Present | Missing Terms of Service |
| Secure Payment Signals | E-Commerce Missing Trust Signals |
| Author Schema with sameAs | Author Schema Missing sameAs |
| Press / Media Mentions | No Third-Party Media Coverage |
| Positive Brand Sentiment | Negative Brand Reputation Signals |
| Forum and Community Presence | No Community Presence |
| Structured Data for Organization | No Organization Schema |
| Consistency of Brand Identity | Inconsistent Brand Identity Online |
| YMYL Content Medical/Financial Review | YMYL Content Without Expert Review |
| Transparent Methodology | Data Without Methodology |

### AI Overviews & AIO Optimization
| name | issue_name |
|------|-----------|
| Passage-Level Clarity | Content Not Quotable as Standalone Passage |
| Definition / Summary Paragraph | No Clear Summary Near Top of Page |
| Question-Answer Format Content | Content Doesn't Match PAA Questions |
| Factual Accuracy and Verifiability | Unverifiable Facts in Content |
| Schema Markup for AI Readability | No Schema for AI Content Parsing |
| Content Freshness for AI | Outdated Content for AI Crawlers |
| Cited by AI Chatbots | Brand Not Cited by AI Assistants |
| Authoritative Tone | Hedging Language Undermining Authority |
| Concise Answers Before Detail | No Direct Answer Before Detail |
| Long-Tail Question Coverage | Long-Tail Questions Not Addressed |
| Speakable Schema | No Speakable Schema on Citable Content |
| Content in AI Training Data Sources | No Presence on AI-Indexed Platforms |
| Table of Contents with Anchors | No Table of Contents on Long Content |
| Featured Snippet Optimization | No Featured Snippets Captured for AIO |
| Entities and NLP Clarity | Ambiguous Entity References |
| Unique Insights Not Found Elsewhere | Fully Derivative Content |
| Negative AIO Impact Mitigation | No AIO Impact Strategy |
| NLP-Friendly Content Structure | Unstructured Content for NLP Parsing |
| Content Length for Coverage | Content Too Short for Comprehensive Coverage |

### GEO & LLM Crawlers
| name | issue_name |
|------|-----------|
| LLMs.txt File Present | Missing llms.txt File |
| AI Bot Access in Robots.txt | No AI Crawler Policy in Robots.txt |
| Google-Extended Directive | No Google-Extended Directive |
| Content Available Without JS for AI | Content Requires JS (AI Crawlers Blocked) |
| Topical Authority Signals for AI | Insufficient Topical Authority for AI Citation |
| Brand Entity in AI Knowledge Bases | Brand Not in AI Knowledge Bases |
| Content on AI-Indexed Platforms | No Presence on AI-Trusted Platforms |
| Crawlable Pagination | Infinite Scroll Not Crawlable by AI |
| Structured FAQs Accessible to AI | FAQs Not Accessible Without JS |
| Canonical URL for AI Deduplication | Duplicate URLs Without Canonical |
| Open Graph Tags for Social AI | Missing Open Graph Tags |
| Content Depth on Single URL | Topic Split Across Thin Pages |
| HTTPS for AI Crawler Trust | HTTP Content Inaccessible to AI Crawlers |
| Content Licensing / Usage Policy | No AI Content Usage Policy |
| Perplexity / ChatGPT Citation Audit | No AI Citation Monitoring |

### Local SEO & GEO
| name | issue_name |
|------|-----------|
| Google Business Profile Exists | Unclaimed or Unverified Google Business Profile |
| GBP Category Accuracy | Incorrect GBP Primary Category |
| NAP Consistency (Name/Address/Phone) | NAP Inconsistency Across Citations |
| LocalBusiness Schema on Website | Missing LocalBusiness Schema |
| GBP Reviews (Volume) | Insufficient Google Reviews |
| GBP Reviews (Rating) | Poor Google Review Rating |
| Review Response Rate | Low Review Response Rate |
| GBP Photos Count and Quality | Insufficient GBP Photos |
| GBP Posts Active | No Recent GBP Posts |
| GBP Q&A Answered | Unanswered GBP Questions |
| Citation Count | Low Citation Count |
| Citation Consistency | Inconsistent Citations |
| Location Page Quality | Thin or Templated Location Page |
| Location Page Crawlable | Location Page Not Indexed |
| Embedded Google Map on Location Page | No Embedded Map on Location Page |
| Local Phone Number (not 800) | Toll-Free Number Instead of Local Number |
| Service Area Defined in GBP | SAB Missing Service Area in GBP |
| Review Diversity Across Platforms | Reviews Only on Google (No Diversity) |
| Opening Hours Accuracy | Inaccurate Business Hours |
| Local Content Marketing | No Locally Relevant Content |
| Local Backlinks | No Local Backlinks |
| Competitor GBP Comparison | No Local Competitor Analysis |
| Geo-Modified Keywords on Page | No Geo-Modified Keywords on Location Page |
| Schema Geo Coordinates | Missing Geo Coordinates in Schema |
| Multiple Locations Management | Inconsistent Multi-Location Strategy |

---

## 7. Files to Change (Implementation Checklist)

```
[ ] backend/db/migrations/018_audit_checks_rebuild.js   ← DONE
[ ] backend/db/seed/audit-checks.js                     ← REWRITE (321 checks)
[ ] backend/__tests__/audit-checks-seed.test.js         ← UPDATE counts + categories
[ ] backend/routes/reports.js                           ← UPDATE join (name OR issue_name)
[ ] backend/services/audit-parser.service.js            ← VERIFY issueType matches issue_name
[ ] frontend/src/components/audit/auditCategories.js    ← UPDATE 19→23 categories
[ ] frontend/src/router.jsx (or App.jsx)                ← ADD routes for 4 new categories
[ ] frontend/src/pages/AuditCategory.jsx                ← ADD grey check rendering
[ ] PRD.md (project root)                               ← UPDATE to reflect new check model
```

---

## 8. Test Verification

After seed is written and migration runs:

```bash
cd backend && npm test
```

Expected:
- `AUDIT_CHECKS array` → 321 checks, no duplicates, all required fields
- `seedAuditChecks()` → inserts 321 rows, idempotent (second call returns 0)
- All 23 categories present

Parser verification (after issueType strings are confirmed):
```bash
# Audit a test URL and verify issue_type values in audit_results match issue_name in audit_checks
SELECT ar.issue_type, ac.name, ac.issue_name
FROM audit_results ar
LEFT JOIN audit_checks ac ON ac.issue_name = ar.issue_type OR ac.name = ar.issue_type
WHERE ac.id IS NULL
LIMIT 20;
-- Should return 0 rows (all issueTypes match a check)
```

---

## 9. What NOT to Change

- `audit_results` table schema — no changes needed
- `ai_suggestions` table schema — check_id gets re-linked after seed runs
- Any other migration files — do not edit existing migrations
- `.env` — no new env vars needed for this phase

---

## 10. Context for Fresh Session

- **Worktree:** `.worktrees/audit-phase2` on branch `feature/audit-phase2`
- **Main project:** `/Users/a39326/Documents/Aakash/`
- **DB location:** `backend/seo-automation.db` — DO NOT delete
- **Migration runner:** automatically runs on `npm start` via `runMigrations()` in `server.js`
- **better-sqlite3 is synchronous** — never use async/await on DB calls
- **Full check CSV:** `~/Downloads/audit-replan-subchecks-comprehensive.csv`
- **CLAUDE.md** has all project rules — read it first in any new session
- **Primary join in reports.js:** line 44–48, `WHERE name = ?` → change to `WHERE name = ? OR issue_name = ?`
