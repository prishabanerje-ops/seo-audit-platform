/**
 * Audit checks seed — v2.
 * Auto-generated from docs/audit-checks/check-catalog.md
 * Regenerate: node scripts/generate-audit-checks-seed.js
 * DO NOT EDIT MANUALLY.
 *
 * 351 checks across all sections.
 */

export const AUDIT_CHECKS = [
  {
    "check_id": "http_status",
    "name": "200 Status Code",
    "section": "Response Codes & Redirects",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "redirect_301_vs_302",
    "name": "301 vs 302 Usage",
    "section": "Response Codes & Redirects",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "redirect_chain",
    "name": "Redirect Chains",
    "section": "Response Codes & Redirects",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "redirect_loop",
    "name": "Redirect Loops",
    "section": "Response Codes & Redirects",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "redirect_to_https",
    "name": "Redirect to HTTPS",
    "section": "Response Codes & Redirects",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "broken_pages_4xx",
    "name": "4xx Broken Pages",
    "section": "Response Codes & Redirects",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "server_errors_5xx",
    "name": "5xx Server Errors",
    "section": "Response Codes & Redirects",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "temp_redirect_overuse",
    "name": "Temporary Redirect Overuse",
    "section": "Response Codes & Redirects",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "redirect_count",
    "name": "Redirect Count",
    "section": "Response Codes & Redirects",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "gone_vs_not_found",
    "name": "Gone vs Not Found",
    "section": "Response Codes & Redirects",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "self_referencing_canonical",
    "name": "Self-Referencing Canonical",
    "section": "Canonicalisation",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "duplicate_canonical_tags",
    "name": "Duplicate Canonical Tags",
    "section": "Canonicalisation",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "canonical_points_https",
    "name": "Canonical Points to HTTPS",
    "section": "Canonicalisation",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "canonical_to_error",
    "name": "Canonical to 4xx or 5xx",
    "section": "Canonicalisation",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "canonical_loop",
    "name": "Canonical Loops",
    "section": "Canonicalisation",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "reciprocal_canonical",
    "name": "Reciprocal Canonicals",
    "section": "Canonicalisation",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "trailing_slash_canonical",
    "name": "Trailing Slash Canonical",
    "section": "Canonicalisation",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "paginated_canonical",
    "name": "Paginated Pages Canonical",
    "section": "Canonicalisation",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "url_parameter_canonical",
    "name": "URL Parameter Handling",
    "section": "Canonicalisation",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "hreflang_canonical_conflict",
    "name": "Hreflang vs Canonical Conflict",
    "section": "Canonicalisation",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "robots_txt_exists",
    "name": "Robots.txt Exists",
    "section": "Robots & Crawl Directives",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "robots_txt_syntax",
    "name": "Robots.txt Valid Syntax",
    "section": "Robots & Crawl Directives",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "sitemap_in_robots",
    "name": "Sitemap Declared in Robots.txt",
    "section": "Robots & Crawl Directives",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "crawlable_resources_not_blocked",
    "name": "Crawlable Resources Not Blocked",
    "section": "Robots & Crawl Directives",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "sensitive_paths_blocked",
    "name": "Sensitive Paths Blocked",
    "section": "Robots & Crawl Directives",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "important_pages_not_blocked",
    "name": "Important Pages Not Blocked",
    "section": "Robots & Crawl Directives",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "conflicting_directives",
    "name": "Conflicting Directives",
    "section": "Robots & Crawl Directives",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "ai_crawler_directives",
    "name": "AI Crawler Directives",
    "section": "Robots & Crawl Directives",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "noindex_not_disallowed",
    "name": "Meta Noindex Not Contradicting Disallow",
    "section": "Robots & Crawl Directives",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "crawl_delay",
    "name": "Crawl-Delay Set If Needed",
    "section": "Robots & Crawl Directives",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "sitemap_exists",
    "name": "Sitemap Exists",
    "section": "XML Sitemaps",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "sitemap_valid_xml",
    "name": "Valid XML Format",
    "section": "XML Sitemaps",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "sitemap_url_count",
    "name": "Sitemap URL Count",
    "section": "XML Sitemaps",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "sitemap_file_size",
    "name": "Sitemap File Size",
    "section": "XML Sitemaps",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "sitemap_index_used",
    "name": "Sitemap Index for Large Sites",
    "section": "XML Sitemaps",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "no_blocked_urls_in_sitemap",
    "name": "No Blocked URLs in Sitemap",
    "section": "XML Sitemaps",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "no_4xx_in_sitemap",
    "name": "No 4xx/5xx URLs in Sitemap",
    "section": "XML Sitemaps",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "no_redirect_in_sitemap",
    "name": "No Redirect URLs in Sitemap",
    "section": "XML Sitemaps",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "sitemap_orphan_urls",
    "name": "Orphan URLs in Sitemap",
    "section": "XML Sitemaps",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "sitemap_lastmod",
    "name": "Lastmod Accuracy",
    "section": "XML Sitemaps",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "sitemap_image",
    "name": "Image Sitemap",
    "section": "XML Sitemaps",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "sitemap_video",
    "name": "Video Sitemap",
    "section": "XML Sitemaps",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "noindex_in_sitemap",
    "name": "No Noindexed URLs in Sitemap",
    "section": "XML Sitemaps",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "sitemap_submitted_gsc",
    "name": "Sitemap Submitted to GSC",
    "section": "XML Sitemaps",
    "severity": "info",
    "feasibility": "gsc"
  },
  {
    "check_id": "news_sitemap",
    "name": "News Sitemap",
    "section": "XML Sitemaps",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "meta_noindex_correct",
    "name": "Meta Noindex Used Correctly",
    "section": "Crawlability & Indexability",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "x_robots_tag",
    "name": "X-Robots-Tag Header",
    "section": "Crawlability & Indexability",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "crawl_depth",
    "name": "Crawl Depth",
    "section": "Crawlability & Indexability",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "orphan_pages",
    "name": "Orphan Pages",
    "section": "Crawlability & Indexability",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "soft_404",
    "name": "Soft 404 Detection",
    "section": "Crawlability & Indexability",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "session_ids_in_urls",
    "name": "Session IDs in URLs",
    "section": "Crawlability & Indexability",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "crawl_trap",
    "name": "Crawl Trap / Infinite Parameters",
    "section": "Crawlability & Indexability",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "url_parameters_handled",
    "name": "URL Parameters Handled",
    "section": "Crawlability & Indexability",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "nofollow_internal_links",
    "name": "Nofollow Internal Links",
    "section": "Crawlability & Indexability",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "noindex_paginated",
    "name": "Noindex on Paginated Pages",
    "section": "Crawlability & Indexability",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "url_length",
    "name": "URL Length",
    "section": "URL Structure",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "url_lowercase",
    "name": "Lowercase Characters",
    "section": "URL Structure",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "url_hyphens",
    "name": "Hyphen Word Separators",
    "section": "URL Structure",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "url_special_chars",
    "name": "Special Characters in Slug",
    "section": "URL Structure",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "url_keyword",
    "name": "Keyword in URL",
    "section": "URL Structure",
    "severity": "info",
    "feasibility": "kw_upload"
  },
  {
    "check_id": "url_descriptive",
    "name": "Descriptive URL Slugs",
    "section": "URL Structure",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "url_trailing_slash",
    "name": "Trailing Slash Consistency",
    "section": "URL Structure",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "url_deep_nesting",
    "name": "Deep Nesting",
    "section": "URL Structure",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "subdomain_vs_subfolder",
    "name": "Subdomain vs Subfolder",
    "section": "URL Structure",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "url_date_format",
    "name": "Date Format in URLs",
    "section": "URL Structure",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "js_critical_content",
    "name": "Critical Content in Raw HTML",
    "section": "JavaScript Rendering",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "js_metadata",
    "name": "Metadata in Raw HTML",
    "section": "JavaScript Rendering",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "js_link_discovery",
    "name": "Link Discovery via JS",
    "section": "JavaScript Rendering",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "js_structured_data",
    "name": "Structured Data Rendering",
    "section": "JavaScript Rendering",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "js_render_comparison",
    "name": "Render Comparison",
    "section": "JavaScript Rendering",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "js_csr_vs_ssr",
    "name": "CSR vs SSR",
    "section": "JavaScript Rendering",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "js_two_wave_risk",
    "name": "Two-Wave Indexing Risk",
    "section": "JavaScript Rendering",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "js_lazy_loaded",
    "name": "Lazy-Loaded Content",
    "section": "JavaScript Rendering",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "js_dependencies_order",
    "name": "JS Dependencies Load Order",
    "section": "JavaScript Rendering",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "js_crawl_budget_render",
    "name": "Crawl Budget vs Rendering Time",
    "section": "JavaScript Rendering",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "viewport_meta",
    "name": "Viewport Meta Tag",
    "section": "Mobile & Usability",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "mobile_responsive",
    "name": "Mobile Responsiveness",
    "section": "Mobile & Usability",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "tap_target_size",
    "name": "Tap Target Size",
    "section": "Mobile & Usability",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "text_legibility",
    "name": "Text Size Legibility",
    "section": "Mobile & Usability",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "horizontal_scroll",
    "name": "Horizontal Scroll",
    "section": "Mobile & Usability",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "zoom_disabled",
    "name": "Zoom Disabled",
    "section": "Mobile & Usability",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "mobile_interstitials",
    "name": "Interstitials on Mobile",
    "section": "Mobile & Usability",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "mobile_content_parity",
    "name": "Content Parity Mobile vs Desktop",
    "section": "Mobile & Usability",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "touch_spacing",
    "name": "Touch Spacing",
    "section": "Mobile & Usability",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "mobile_speed",
    "name": "Mobile Speed",
    "section": "Mobile & Usability",
    "severity": "critical",
    "feasibility": "psi"
  },
  {
    "check_id": "app_install_banners",
    "name": "App Install Banners",
    "section": "Mobile & Usability",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "https_enabled",
    "name": "HTTPS Enabled",
    "section": "Security & HTTPS",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "ssl_valid",
    "name": "SSL Certificate Valid",
    "section": "Security & HTTPS",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "ssl_chain_complete",
    "name": "SSL Certificate Chain Complete",
    "section": "Security & HTTPS",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "hsts_header",
    "name": "HSTS Header",
    "section": "Security & HTTPS",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "csp_header",
    "name": "Content Security Policy",
    "section": "Security & HTTPS",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "x_frame_options",
    "name": "X-Frame-Options",
    "section": "Security & HTTPS",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "x_content_type_options",
    "name": "X-Content-Type-Options",
    "section": "Security & HTTPS",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "referrer_policy",
    "name": "Referrer-Policy",
    "section": "Security & HTTPS",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "mixed_content",
    "name": "Mixed Content",
    "section": "Security & HTTPS",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "security_headers_grade",
    "name": "Security Headers Grade",
    "section": "Security & HTTPS",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "permissions_policy",
    "name": "Permissions-Policy",
    "section": "Security & HTTPS",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "lab_ttfb",
    "name": "TTFB (Time to First Byte)",
    "section": "Core Web Vitals",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "lab_render_blocking",
    "name": "Render Blocking Resources",
    "section": "Core Web Vitals",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "lab_request_count",
    "name": "Total Network Requests",
    "section": "Core Web Vitals",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "lab_asset_weight",
    "name": "JS + CSS Asset Weight",
    "section": "Core Web Vitals",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "psi_lcp",
    "name": "LCP (Largest Contentful Paint)",
    "section": "Core Web Vitals",
    "severity": "critical",
    "feasibility": "psi"
  },
  {
    "check_id": "psi_cls",
    "name": "CLS (Cumulative Layout Shift)",
    "section": "Core Web Vitals",
    "severity": "critical",
    "feasibility": "psi"
  },
  {
    "check_id": "psi_fcp",
    "name": "FCP (First Contentful Paint)",
    "section": "Core Web Vitals",
    "severity": "info",
    "feasibility": "psi"
  },
  {
    "check_id": "psi_score",
    "name": "Lighthouse Performance Score",
    "section": "Core Web Vitals",
    "severity": "info",
    "feasibility": "psi"
  },
  {
    "check_id": "mobile_cwv",
    "name": "Mobile CWV Performance",
    "section": "Core Web Vitals",
    "severity": "critical",
    "feasibility": "psi"
  },
  {
    "check_id": "cwv_pass_rate",
    "name": "CWV Pass Rate",
    "section": "Core Web Vitals",
    "severity": "critical",
    "feasibility": "psi"
  },
  {
    "check_id": "crux_lcp",
    "name": "CrUX LCP (real users, p75)",
    "section": "Core Web Vitals",
    "severity": "critical",
    "feasibility": "crux"
  },
  {
    "check_id": "crux_inp",
    "name": "CrUX INP (real users, p75)",
    "section": "Core Web Vitals",
    "severity": "critical",
    "feasibility": "crux"
  },
  {
    "check_id": "crux_cls",
    "name": "CrUX CLS (real users, p75)",
    "section": "Core Web Vitals",
    "severity": "critical",
    "feasibility": "crux"
  },
  {
    "check_id": "lcp_element_id",
    "name": "LCP Element Identification",
    "section": "Core Web Vitals",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "cls_causes",
    "name": "CLS Causes",
    "section": "Core Web Vitals",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "cwv_trend",
    "name": "CWV Trend Over Time",
    "section": "Core Web Vitals",
    "severity": "warning",
    "feasibility": "crux"
  },
  {
    "check_id": "title_present",
    "name": "Title Tag Present",
    "section": "Title Tags",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "title_unique",
    "name": "Title Tag Unique",
    "section": "Title Tags",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "title_length_chars",
    "name": "Title Tag Length (Characters)",
    "section": "Title Tags",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "title_pixel_width",
    "name": "Title Tag Pixel Width",
    "section": "Title Tags",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "title_primary_keyword",
    "name": "Primary Keyword in Title",
    "section": "Title Tags",
    "severity": "warning",
    "feasibility": "kw_upload"
  },
  {
    "check_id": "title_keyword_position",
    "name": "Keyword Position in Title",
    "section": "Title Tags",
    "severity": "warning",
    "feasibility": "kw_upload"
  },
  {
    "check_id": "title_brand",
    "name": "Brand in Title",
    "section": "Title Tags",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "title_keyword_stuffing",
    "name": "Keyword Stuffing in Title",
    "section": "Title Tags",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "title_relevance",
    "name": "Title Relevance to Content",
    "section": "Title Tags",
    "severity": "warning",
    "feasibility": "ai"
  },
  {
    "check_id": "title_h1_diff",
    "name": "Title vs H1 Differentiation",
    "section": "Title Tags",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "meta_desc_present",
    "name": "Meta Description Present",
    "section": "Meta Descriptions",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "meta_desc_unique",
    "name": "Meta Description Unique",
    "section": "Meta Descriptions",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "meta_desc_length",
    "name": "Meta Description Length",
    "section": "Meta Descriptions",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "meta_desc_keyword",
    "name": "Keyword in Description",
    "section": "Meta Descriptions",
    "severity": "warning",
    "feasibility": "kw_upload"
  },
  {
    "check_id": "meta_desc_cta",
    "name": "Call-to-Action in Description",
    "section": "Meta Descriptions",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "meta_desc_accuracy",
    "name": "Description Accuracy",
    "section": "Meta Descriptions",
    "severity": "warning",
    "feasibility": "ai"
  },
  {
    "check_id": "meta_desc_keyword_position",
    "name": "Keyword Position in Description",
    "section": "Meta Descriptions",
    "severity": "info",
    "feasibility": "kw_upload"
  },
  {
    "check_id": "meta_desc_no_html",
    "name": "No HTML Tags in Description",
    "section": "Meta Descriptions",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "meta_desc_encoding",
    "name": "Special Character Encoding",
    "section": "Meta Descriptions",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "meta_desc_auto_generated",
    "name": "Duplicate Auto-Generated Descriptions",
    "section": "Meta Descriptions",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "h1_present",
    "name": "H1 Present",
    "section": "Headings",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "h1_unique",
    "name": "H1 Unique Across Site",
    "section": "Headings",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "h1_relevance",
    "name": "H1 Content Relevance",
    "section": "Headings",
    "severity": "warning",
    "feasibility": "ai"
  },
  {
    "check_id": "h1_length",
    "name": "H1 Length",
    "section": "Headings",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "h2_structure",
    "name": "H2 Structure",
    "section": "Headings",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "heading_hierarchy",
    "name": "Heading Hierarchy",
    "section": "Headings",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "h3_h6_nesting",
    "name": "H3–H6 Nesting Order",
    "section": "Headings",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "h1_keyword",
    "name": "Keyword in H1",
    "section": "Headings",
    "severity": "warning",
    "feasibility": "kw_upload"
  },
  {
    "check_id": "h2_keyword",
    "name": "Keyword in H2s",
    "section": "Headings",
    "severity": "info",
    "feasibility": "kw_upload"
  },
  {
    "check_id": "heading_stuffing",
    "name": "Keyword Stuffing in Headings",
    "section": "Headings",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "word_count",
    "name": "Minimum Word Count",
    "section": "Content Quality",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "cornerstone_word_count",
    "name": "Cornerstone Content Word Count",
    "section": "Content Quality",
    "severity": "warning",
    "feasibility": "kw_upload"
  },
  {
    "check_id": "thin_content",
    "name": "Thin Content Detection",
    "section": "Content Quality",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "duplicate_content",
    "name": "Duplicate Content Internal",
    "section": "Content Quality",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "near_duplicate",
    "name": "Near-Duplicate Content",
    "section": "Content Quality",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "keyword_density",
    "name": "Keyword Density",
    "section": "Content Quality",
    "severity": "info",
    "feasibility": "kw_upload"
  },
  {
    "check_id": "keyword_variations",
    "name": "Keyword Variations Used",
    "section": "Content Quality",
    "severity": "info",
    "feasibility": "kw_upload"
  },
  {
    "check_id": "content_freshness",
    "name": "Content Freshness",
    "section": "Content Quality",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "readability_score",
    "name": "Readability Score",
    "section": "Content Quality",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "original_research",
    "name": "Original Research or Data",
    "section": "Content Quality",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "content_purpose",
    "name": "Content Purpose Clarity",
    "section": "Content Quality",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "fact_checking",
    "name": "Fact Checking",
    "section": "Content Quality",
    "severity": "warning",
    "feasibility": "manual"
  },
  {
    "check_id": "expert_attribution",
    "name": "Expert Attribution",
    "section": "Content Quality",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "actionable_content",
    "name": "Actionable Content",
    "section": "Content Quality",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "content_intent_match",
    "name": "Content-Search Intent Match",
    "section": "Content Quality",
    "severity": "critical",
    "feasibility": "ai"
  },
  {
    "check_id": "img_alt_missing",
    "name": "Alt Text Missing",
    "section": "Images",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "img_alt_empty",
    "name": "Alt Text Empty (non-decorative)",
    "section": "Images",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "img_alt_duplicate",
    "name": "Duplicate Alt Text",
    "section": "Images",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "img_alt_descriptive",
    "name": "Alt Text Descriptive",
    "section": "Images",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "img_decorative_handling",
    "name": "Decorative Image Handling",
    "section": "Images",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "img_file_name",
    "name": "Image File Name",
    "section": "Images",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "img_format",
    "name": "Image File Format",
    "section": "Images",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "img_file_size",
    "name": "Image File Size",
    "section": "Images",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "img_dimensions",
    "name": "Image Dimensions Declared",
    "section": "Images",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "img_lazy_loading",
    "name": "Lazy Loading",
    "section": "Images",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "img_srcset",
    "name": "Responsive Images Srcset",
    "section": "Images",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "img_compression",
    "name": "Image Compression Quality",
    "section": "Images",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "img_aspect_ratio",
    "name": "Width-Height Aspect Ratio",
    "section": "Images",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "img_next_gen",
    "name": "Next-Gen Format Adoption",
    "section": "Images",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "img_broken",
    "name": "Broken Images",
    "section": "Images",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "img_schema",
    "name": "Image Schema Markup",
    "section": "Images",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "img_content_relevance",
    "name": "Image Content Relevance",
    "section": "Images",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "schema_rules",
    "name": "Schema Rules (URL Pattern Mapping)",
    "section": "Schema & Structured Data",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_present",
    "name": "Schema Markup Present",
    "section": "Schema & Structured Data",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_json_ld",
    "name": "JSON-LD Format Used",
    "section": "Schema & Structured Data",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_validation",
    "name": "Schema Validation (Schema.org)",
    "section": "Schema & Structured Data",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_rich_results",
    "name": "Google Rich Results Eligibility",
    "section": "Schema & Structured Data",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_article",
    "name": "Article Schema",
    "section": "Schema & Structured Data",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_product",
    "name": "Product Schema",
    "section": "Schema & Structured Data",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_review",
    "name": "Review / Rating Schema",
    "section": "Schema & Structured Data",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_faq",
    "name": "FAQ Schema",
    "section": "Schema & Structured Data",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_breadcrumb",
    "name": "Breadcrumb Schema",
    "section": "Schema & Structured Data",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_local_business",
    "name": "LocalBusiness Schema",
    "section": "Schema & Structured Data",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_video",
    "name": "Video Schema",
    "section": "Schema & Structured Data",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_event",
    "name": "Event Schema",
    "section": "Schema & Structured Data",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_organization",
    "name": "Organization Schema",
    "section": "Schema & Structured Data",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_howto",
    "name": "HowTo Schema",
    "section": "Schema & Structured Data",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "schema_author",
    "name": "Author Schema",
    "section": "Schema & Structured Data",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "internal_links_200",
    "name": "Internal Links Return 200",
    "section": "Internal Linking",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "no_orphan_pages",
    "name": "No Orphan Pages",
    "section": "Internal Linking",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "internal_link_count",
    "name": "Internal Link Count per Page",
    "section": "Internal Linking",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "internal_crawl_depth",
    "name": "Crawl Depth",
    "section": "Internal Linking",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "anchor_descriptiveness",
    "name": "Anchor Text Descriptiveness",
    "section": "Internal Linking",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "anchor_exact_match",
    "name": "Exact Match Anchor Overuse",
    "section": "Internal Linking",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "internal_nofollow",
    "name": "Nofollow on Internal Links",
    "section": "Internal Linking",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "links_to_important_pages",
    "name": "Links to Important Pages",
    "section": "Internal Linking",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "broken_internal_links",
    "name": "Broken Internal Links",
    "section": "Internal Linking",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "redirect_internal_links",
    "name": "Redirect Internal Links",
    "section": "Internal Linking",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "hreflang_present",
    "name": "Hreflang Tags Present",
    "section": "International SEO",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "hreflang_self_ref",
    "name": "Hreflang Self-Reference",
    "section": "International SEO",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "hreflang_reciprocal",
    "name": "Hreflang Reciprocal",
    "section": "International SEO",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "hreflang_x_default",
    "name": "x-default Hreflang",
    "section": "International SEO",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "hreflang_lang_valid",
    "name": "Hreflang Language Code Validity",
    "section": "International SEO",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "hreflang_url_consistent",
    "name": "Hreflang URL Consistency",
    "section": "International SEO",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "hreflang_indexed",
    "name": "Alternate Language Pages Indexed",
    "section": "International SEO",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "content_language_match",
    "name": "Content Language Match",
    "section": "International SEO",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "intl_url_strategy",
    "name": "ccTLD vs Subdirectory Strategy",
    "section": "International SEO",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "locale_formatting",
    "name": "Currency / Date Localization",
    "section": "International SEO",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "gsc_connected",
    "name": "Google Search Console Connected",
    "section": "Rankings & Traffic",
    "severity": "critical",
    "feasibility": "gsc"
  },
  {
    "check_id": "ga4_connected",
    "name": "GA4 Connected",
    "section": "Rankings & Traffic",
    "severity": "critical",
    "feasibility": "ga4"
  },
  {
    "check_id": "organic_traffic_trend",
    "name": "Organic Traffic Trend",
    "section": "Rankings & Traffic",
    "severity": "warning",
    "feasibility": "gsc"
  },
  {
    "check_id": "avg_ctr",
    "name": "Click-Through Rate (CTR)",
    "section": "Rankings & Traffic",
    "severity": "warning",
    "feasibility": "gsc"
  },
  {
    "check_id": "avg_position_trend",
    "name": "Average Position Trend",
    "section": "Rankings & Traffic",
    "severity": "info",
    "feasibility": "gsc"
  },
  {
    "check_id": "impressions_growth",
    "name": "Impressions Growth",
    "section": "Rankings & Traffic",
    "severity": "info",
    "feasibility": "gsc"
  },
  {
    "check_id": "crawl_coverage_gsc",
    "name": "Crawl Coverage in GSC",
    "section": "Rankings & Traffic",
    "severity": "warning",
    "feasibility": "gsc"
  },
  {
    "check_id": "core_update_impact",
    "name": "Core Update Impact Detection",
    "section": "Rankings & Traffic",
    "severity": "warning",
    "feasibility": "gsc"
  },
  {
    "check_id": "cannibalization_gsc",
    "name": "Cannibalization Detection",
    "section": "Rankings & Traffic",
    "severity": "warning",
    "feasibility": "gsc"
  },
  {
    "check_id": "featured_snippet_gsc",
    "name": "Featured Snippet Presence",
    "section": "Rankings & Traffic",
    "severity": "info",
    "feasibility": "gsc"
  },
  {
    "check_id": "serp_features_gsc",
    "name": "SERP Feature Presence",
    "section": "Rankings & Traffic",
    "severity": "info",
    "feasibility": "gsc"
  },
  {
    "check_id": "branded_traffic_split",
    "name": "Branded vs Non-Branded Split",
    "section": "Rankings & Traffic",
    "severity": "info",
    "feasibility": "gsc"
  },
  {
    "check_id": "keyword_rankings_tracked",
    "name": "Keyword Rankings Tracked",
    "section": "Rankings & Traffic",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "referring_domain_count",
    "name": "Referring Domain Count",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "referring_domain_authority",
    "name": "Referring Domain Authority",
    "section": "Backlinks & Authority",
    "severity": "warning",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "anchor_text_distribution",
    "name": "Anchor Text Distribution",
    "section": "Backlinks & Authority",
    "severity": "warning",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "toxic_links",
    "name": "Toxic / Spammy Links",
    "section": "Backlinks & Authority",
    "severity": "critical",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "dofollow_nofollow_ratio",
    "name": "Dofollow vs Nofollow Ratio",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "link_velocity",
    "name": "Link Velocity",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "lost_backlinks",
    "name": "Lost Backlinks",
    "section": "Backlinks & Authority",
    "severity": "warning",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "competitor_link_gap",
    "name": "Competitor Backlink Gap",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "paid_link_detection",
    "name": "Editorial Link vs Paid Link",
    "section": "Backlinks & Authority",
    "severity": "critical",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "link_diversity",
    "name": "Link Diversity (Content Type)",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "internal_pagerank",
    "name": "Internal PageRank Distribution",
    "section": "Backlinks & Authority",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "domain_authority_trend",
    "name": "Domain Authority Trend",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "homepage_link_concentration",
    "name": "Homepage Link Concentration",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "unlinked_brand_mentions",
    "name": "Brand Mentions (Unlinked)",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "disavow_status",
    "name": "Disavow File Status",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "competitor_authority",
    "name": "Competitor Authority Score",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "edu_gov_links",
    "name": "Edu / Gov Links",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "niche_relevance",
    "name": "Niche Relevance of Links",
    "section": "Backlinks & Authority",
    "severity": "warning",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "press_coverage",
    "name": "Press / PR Coverage",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "link_audit_frequency",
    "name": "Link Audit Frequency",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "social_signals",
    "name": "Social Signals Correlation",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "broken_link_opportunities",
    "name": "Broken Link Building Opportunities",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "resource_page_inclusion",
    "name": "Resource Page Inclusion",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "pillow_links_balance",
    "name": "Pillow Links Balance",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "bl_upload"
  },
  {
    "check_id": "link_building_velocity",
    "name": "Link Building Velocity Target",
    "section": "Backlinks & Authority",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "author_expertise",
    "name": "Author Expertise Visible",
    "section": "E-E-A-T Signals",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "author_links",
    "name": "Author Links to Social/Profile",
    "section": "E-E-A-T Signals",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "about_page_quality",
    "name": "About Page Quality",
    "section": "E-E-A-T Signals",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "contact_page_present",
    "name": "Contact Page Present",
    "section": "E-E-A-T Signals",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "physical_address",
    "name": "Physical Address / Location",
    "section": "E-E-A-T Signals",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "external_citations",
    "name": "External Citations",
    "section": "E-E-A-T Signals",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "awards_credentials",
    "name": "Industry Awards and Credentials",
    "section": "E-E-A-T Signals",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "user_reviews",
    "name": "User Reviews and Testimonials",
    "section": "E-E-A-T Signals",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "wikipedia_presence",
    "name": "Wikipedia / Knowledge Graph Presence",
    "section": "E-E-A-T Signals",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "expert_review",
    "name": "Expert Review of Content",
    "section": "E-E-A-T Signals",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "update_history_visible",
    "name": "Content Update History Visible",
    "section": "E-E-A-T Signals",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "privacy_policy_present",
    "name": "Privacy Policy Present",
    "section": "E-E-A-T Signals",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "terms_of_service_present",
    "name": "Terms of Service Present",
    "section": "E-E-A-T Signals",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "secure_payment_signals",
    "name": "Secure Payment Signals",
    "section": "E-E-A-T Signals",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "author_schema_sameas",
    "name": "Author Schema with sameAs",
    "section": "E-E-A-T Signals",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "press_mentions",
    "name": "Press / Media Mentions",
    "section": "E-E-A-T Signals",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "brand_sentiment",
    "name": "Positive Brand Sentiment",
    "section": "E-E-A-T Signals",
    "severity": "warning",
    "feasibility": "manual"
  },
  {
    "check_id": "forum_community",
    "name": "Forum and Community Presence",
    "section": "E-E-A-T Signals",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "org_structured_data",
    "name": "Structured Data for Organization",
    "section": "E-E-A-T Signals",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "brand_consistency",
    "name": "Consistency of Brand Identity",
    "section": "E-E-A-T Signals",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "ymyl_review",
    "name": "YMYL Content Medical/Financial Review",
    "section": "E-E-A-T Signals",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "transparent_methodology",
    "name": "Transparent Methodology",
    "section": "E-E-A-T Signals",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "author_credentials_schema",
    "name": "Author Credentials in Schema",
    "section": "E-E-A-T Signals",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "ymyl_disclaimer_present",
    "name": "Regulatory Disclaimer on YMYL Pages",
    "section": "E-E-A-T Signals",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "ymyl_date_disclosure",
    "name": "Date Disclosure on YMYL Pages",
    "section": "E-E-A-T Signals",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "ymyl_outbound_authority",
    "name": "Authority Links on YMYL Pages",
    "section": "E-E-A-T Signals",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "aio_passage_clarity",
    "name": "Passage-Level Clarity",
    "section": "AI Overviews & AIO Optimization",
    "severity": "critical",
    "feasibility": "ai"
  },
  {
    "check_id": "aio_summary_paragraph",
    "name": "Definition / Summary Paragraph",
    "section": "AI Overviews & AIO Optimization",
    "severity": "critical",
    "feasibility": "ai"
  },
  {
    "check_id": "aio_qa_format",
    "name": "Question-Answer Format Content",
    "section": "AI Overviews & AIO Optimization",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "aio_factual_accuracy",
    "name": "Factual Accuracy and Verifiability",
    "section": "AI Overviews & AIO Optimization",
    "severity": "critical",
    "feasibility": "manual"
  },
  {
    "check_id": "aio_schema_ai_readability",
    "name": "Schema Markup for AI Readability",
    "section": "AI Overviews & AIO Optimization",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "aio_content_freshness",
    "name": "Content Freshness for AI",
    "section": "AI Overviews & AIO Optimization",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "aio_cited_by_ai",
    "name": "Cited by AI Chatbots",
    "section": "AI Overviews & AIO Optimization",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "aio_authoritative_tone",
    "name": "Authoritative Tone",
    "section": "AI Overviews & AIO Optimization",
    "severity": "warning",
    "feasibility": "ai"
  },
  {
    "check_id": "aio_concise_answers",
    "name": "Concise Answers Before Detail",
    "section": "AI Overviews & AIO Optimization",
    "severity": "warning",
    "feasibility": "ai"
  },
  {
    "check_id": "aio_longtail_coverage",
    "name": "Long-Tail Question Coverage",
    "section": "AI Overviews & AIO Optimization",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "aio_speakable",
    "name": "Speakable Schema",
    "section": "AI Overviews & AIO Optimization",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "aio_training_data",
    "name": "Content in AI Training Data Sources",
    "section": "AI Overviews & AIO Optimization",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "aio_toc_anchors",
    "name": "Table of Contents with Anchors",
    "section": "AI Overviews & AIO Optimization",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "aio_featured_snippet",
    "name": "Featured Snippet Optimization",
    "section": "AI Overviews & AIO Optimization",
    "severity": "warning",
    "feasibility": "gsc"
  },
  {
    "check_id": "aio_entities",
    "name": "Entities and NLP Clarity",
    "section": "AI Overviews & AIO Optimization",
    "severity": "warning",
    "feasibility": "ai"
  },
  {
    "check_id": "aio_unique_insights",
    "name": "Unique Insights Not Found Elsewhere",
    "section": "AI Overviews & AIO Optimization",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "aio_negative_impact",
    "name": "Negative AIO Impact Mitigation",
    "section": "AI Overviews & AIO Optimization",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "aio_nlp_structure",
    "name": "NLP-Friendly Content Structure",
    "section": "AI Overviews & AIO Optimization",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "aio_content_length",
    "name": "Content Length for Coverage",
    "section": "AI Overviews & AIO Optimization",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_llms_txt",
    "name": "LLMs.txt File Present",
    "section": "GEO & LLM Crawlers",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_llms_full_txt",
    "name": "LLMs-Full.txt File Present",
    "section": "GEO & LLM Crawlers",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_llms_txt_quality",
    "name": "LLMs.txt Structure Quality",
    "section": "GEO & LLM Crawlers",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_url_md_endpoint",
    "name": "URL-Level Markdown Endpoint Accessible",
    "section": "GEO & LLM Crawlers",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_ai_bot_robots",
    "name": "AI Bot Access in Robots.txt",
    "section": "GEO & LLM Crawlers",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_google_extended",
    "name": "Google-Extended Directive",
    "section": "GEO & LLM Crawlers",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_content_without_js",
    "name": "Content Available Without JS for AI",
    "section": "GEO & LLM Crawlers",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_topical_authority",
    "name": "Topical Authority Signals for AI",
    "section": "GEO & LLM Crawlers",
    "severity": "warning",
    "feasibility": "manual"
  },
  {
    "check_id": "geo_brand_entity",
    "name": "Brand Entity in AI Knowledge Bases",
    "section": "GEO & LLM Crawlers",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "geo_ai_platform_presence",
    "name": "Content on AI-Indexed Platforms",
    "section": "GEO & LLM Crawlers",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "geo_crawlable_pagination",
    "name": "Crawlable Pagination",
    "section": "GEO & LLM Crawlers",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_faq_html",
    "name": "Structured FAQs Accessible to AI",
    "section": "GEO & LLM Crawlers",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_canonical_dedup",
    "name": "Canonical URL for AI Deduplication",
    "section": "GEO & LLM Crawlers",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_og_tags",
    "name": "Open Graph Tags for Social AI",
    "section": "GEO & LLM Crawlers",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_content_depth",
    "name": "Content Depth on Single URL",
    "section": "GEO & LLM Crawlers",
    "severity": "warning",
    "feasibility": "ai"
  },
  {
    "check_id": "geo_https_trust",
    "name": "HTTPS for AI Crawler Trust",
    "section": "GEO & LLM Crawlers",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_licensing_policy",
    "name": "Content Licensing / Usage Policy",
    "section": "GEO & LLM Crawlers",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "geo_citation_audit",
    "name": "Perplexity / ChatGPT Citation Audit",
    "section": "GEO & LLM Crawlers",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "local_gbp_exists",
    "name": "Google Business Profile Exists",
    "section": "Local SEO & GEO",
    "severity": "critical",
    "feasibility": "manual"
  },
  {
    "check_id": "local_gbp_category",
    "name": "GBP Category Accuracy",
    "section": "Local SEO & GEO",
    "severity": "critical",
    "feasibility": "manual"
  },
  {
    "check_id": "local_nap_consistency",
    "name": "NAP Consistency (Name/Address/Phone)",
    "section": "Local SEO & GEO",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "local_business_schema",
    "name": "LocalBusiness Schema on Website",
    "section": "Local SEO & GEO",
    "severity": "critical",
    "feasibility": "automated"
  },
  {
    "check_id": "local_gbp_reviews_volume",
    "name": "GBP Reviews (Volume)",
    "section": "Local SEO & GEO",
    "severity": "warning",
    "feasibility": "manual"
  },
  {
    "check_id": "local_gbp_reviews_rating",
    "name": "GBP Reviews (Rating)",
    "section": "Local SEO & GEO",
    "severity": "critical",
    "feasibility": "manual"
  },
  {
    "check_id": "local_review_response",
    "name": "Review Response Rate",
    "section": "Local SEO & GEO",
    "severity": "warning",
    "feasibility": "manual"
  },
  {
    "check_id": "local_gbp_photos",
    "name": "GBP Photos Count and Quality",
    "section": "Local SEO & GEO",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "local_gbp_posts",
    "name": "GBP Posts Active",
    "section": "Local SEO & GEO",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "local_gbp_qa",
    "name": "GBP Q&A Answered",
    "section": "Local SEO & GEO",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "local_citation_count",
    "name": "Citation Count",
    "section": "Local SEO & GEO",
    "severity": "warning",
    "feasibility": "manual"
  },
  {
    "check_id": "local_citation_consistency",
    "name": "Citation Consistency",
    "section": "Local SEO & GEO",
    "severity": "critical",
    "feasibility": "manual"
  },
  {
    "check_id": "local_location_page_quality",
    "name": "Location Page Quality",
    "section": "Local SEO & GEO",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "local_location_crawlable",
    "name": "Location Page Crawlable",
    "section": "Local SEO & GEO",
    "severity": "warning",
    "feasibility": "automated"
  },
  {
    "check_id": "local_google_map_embedded",
    "name": "Embedded Google Map on Location Page",
    "section": "Local SEO & GEO",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "local_phone_number",
    "name": "Local Phone Number (not 800)",
    "section": "Local SEO & GEO",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "local_service_area",
    "name": "Service Area Defined in GBP",
    "section": "Local SEO & GEO",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "local_review_diversity",
    "name": "Review Diversity Across Platforms",
    "section": "Local SEO & GEO",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "local_opening_hours",
    "name": "Opening Hours Accuracy",
    "section": "Local SEO & GEO",
    "severity": "warning",
    "feasibility": "manual"
  },
  {
    "check_id": "local_content_marketing",
    "name": "Local Content Marketing",
    "section": "Local SEO & GEO",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "local_backlinks",
    "name": "Local Backlinks",
    "section": "Local SEO & GEO",
    "severity": "warning",
    "feasibility": "manual"
  },
  {
    "check_id": "local_competitor_gbp",
    "name": "Competitor GBP Comparison",
    "section": "Local SEO & GEO",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "local_geo_keywords",
    "name": "Geo-Modified Keywords on Page",
    "section": "Local SEO & GEO",
    "severity": "warning",
    "feasibility": "kw_upload"
  },
  {
    "check_id": "local_schema_geo",
    "name": "Schema Geo Coordinates",
    "section": "Local SEO & GEO",
    "severity": "info",
    "feasibility": "automated"
  },
  {
    "check_id": "local_multiple_locations",
    "name": "Multiple Locations Management",
    "section": "Local SEO & GEO",
    "severity": "info",
    "feasibility": "manual"
  },
  {
    "check_id": "ai_content_quality",
    "name": "Content Quality Audit",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "ai_competitor_gap",
    "name": "Competitor Gap Analysis",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "ai_intent_classification",
    "name": "Intent Classification",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "ai_entity_coverage",
    "name": "Entity Coverage",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "ai_meta_optimisation",
    "name": "Meta Optimisation",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "ai_content_structure",
    "name": "Content Structure Audit",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "ai_internal_linking",
    "name": "Internal Linking Suggestions",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "ai_cannibalization",
    "name": "Cannibalization Detection (AI layer)",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "ai_content_refresh",
    "name": "Content Refresh Detection",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "ai_brand_voice",
    "name": "Brand Voice Consistency",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "ai_composite_score",
    "name": "Composite Content Score",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "ai_serp_opportunities",
    "name": "SERP Feature Opportunities",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "ai_content_freshness_detect",
    "name": "Content Refresh Detection (AI layer)",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  },
  {
    "check_id": "ai_author_topic_match",
    "name": "Author Credential–Topic Alignment",
    "section": "AI Checks",
    "severity": "info",
    "feasibility": "ai"
  }
];

/**
 * Seeds audit_checks table. Idempotent — INSERT OR IGNORE.
 * @param {import('better-sqlite3').Database} db
 */
export function seedAuditChecks(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO audit_checks (check_id, name, section, severity_default, feasibility)
    VALUES (@check_id, @name, @section, @severity, @feasibility)
  `);
  const insertAll = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertAll(AUDIT_CHECKS);
}
