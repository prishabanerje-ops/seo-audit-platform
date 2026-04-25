# Dry-Run Decision Table (first 25 CSV rows)

| csv_row | category | original_name | rule_fired | decision | revised_name | rationale |
|---|---|---|---|---|---|---|
| 2 | Response Codes & Redirects | 200 Status Code | R-K | keep |  | default |
| 3 | Response Codes & Redirects | 301 vs 302 Usage | R-K | keep |  | default |
| 4 | Response Codes & Redirects | Redirect Chains | R-K | keep |  | default |
| 5 | Response Codes & Redirects | Redirect Loops | R-K | keep |  | default |
| 6 | Response Codes & Redirects | Redirect to HTTPS | R-K | keep |  | default |
| 7 | Response Codes & Redirects | 4xx Broken Pages | R-K | keep |  | default |
| 8 | Response Codes & Redirects | 5xx Server Errors | R-K | keep |  | default |
| 9 | Response Codes & Redirects | Temporary Redirect Overuse | R-K | keep |  | default |
| 10 | Response Codes & Redirects | Redirect Count | R-K | keep |  | default |
| 11 | Response Codes & Redirects | Gone vs Not Found | R-K | keep |  | default |
| 12 | Canonicalisation | Self-Referencing Canonical | R-K | keep |  | default |
| 13 | Canonicalisation | Duplicate Canonical Tags | R-K | keep |  | default |
| 14 | Canonicalisation | Canonical Points to HTTPS | R-K | keep |  | default |
| 15 | Canonicalisation | Canonical to 4xx or 5xx | R-K | keep |  | default |
| 16 | Canonicalisation | Canonical Loops | R-K | keep |  | default |
| 17 | Canonicalisation | Reciprocal Canonicals | R-K | keep |  | default |
| 18 | Canonicalisation | Trailing Slash Canonical | R-K | keep |  | default |
| 19 | Canonicalisation | Paginated Pages Canonical | R-K | keep |  | default |
| 20 | Canonicalisation | URL Parameter Handling | R-K | keep |  | default |
| 21 | Canonicalisation | Hreflang vs Canonical Conflict | R-K | keep |  | default |
| 22 | Robots & Crawl Directives | Robots.txt Exists | R-K | keep |  | default |
| 23 | Robots & Crawl Directives | Robots.txt Valid Syntax | R-K | keep |  | default |
| 24 | Robots & Crawl Directives | Sitemap Declared in Robots.txt | R-K | keep |  | default |
| 25 | Robots & Crawl Directives | Crawlable Resources Not Blocked | R-K | keep |  | default |
| 26 | Robots & Crawl Directives | Sensitive Paths Blocked | R-K | keep |  | default |
