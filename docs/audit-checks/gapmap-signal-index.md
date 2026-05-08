# Gap-Map Signal Index

Total signals extracted: **213**

## Priority 1 (30 signals)

| signal_id | name | type | file:line |
|---|---|---|---|
| P1-S001 | 3xx Redirects | issue-emitter | backend/services/audit-parser.service.js:63 |
| P1-S002 | 4xx Client Errors | issue-emitter | backend/services/audit-parser.service.js:72 |
| P1-S003 | 5xx Server Errors | issue-emitter | backend/services/audit-parser.service.js:81 |
| P1-S004 | Redirect Chains | issue-emitter | backend/services/audit-parser.service.js:90 |
| P1-S005 | Redirect Loops | issue-emitter | backend/services/audit-parser.service.js:99 |
| P1-S006 | Missing Title Tag | issue-emitter | backend/services/audit-parser.service.js:129 |
| P1-S007 | Duplicate Title Tag | issue-emitter | backend/services/audit-parser.service.js:138 |
| P1-S008 | Title Too Short (under 30 chars) | issue-emitter | backend/services/audit-parser.service.js:146 |
| P1-S009 | Title Too Long (over 60 chars) | issue-emitter | backend/services/audit-parser.service.js:154 |
| P1-S010 | Dynamic Parameters in Titles | issue-emitter | backend/services/audit-parser.service.js:162 |
| P1-S011 | Missing Meta Description | issue-emitter | backend/services/audit-parser.service.js:192 |
| P1-S012 | Duplicate Meta Description | issue-emitter | backend/services/audit-parser.service.js:201 |
| P1-S013 | Meta Description Too Short (<70) | issue-emitter | backend/services/audit-parser.service.js:209 |
| P1-S014 | Meta Description Too Long (>160) | issue-emitter | backend/services/audit-parser.service.js:217 |
| P1-S015 | H1 Missing | issue-emitter | backend/services/audit-parser.service.js:249 |
| P1-S016 | H1 Duplicate | issue-emitter | backend/services/audit-parser.service.js:258 |
| P1-S017 | Multiple H1s | issue-emitter | backend/services/audit-parser.service.js:266 |
| P1-S018 | Missing H2/H3 | issue-emitter | backend/services/audit-parser.service.js:290 |
| P1-S019 | Missing Canonical | issue-emitter | backend/services/audit-parser.service.js:309 |
| P1-S020 | Canonical is Relative | issue-emitter | backend/services/audit-parser.service.js:317 |
| P1-S021 | Canonical Contains Fragment (#) | issue-emitter | backend/services/audit-parser.service.js:325 |
| P1-S022 | Underscores in URLs | issue-emitter | backend/services/audit-parser.service.js:357 |
| P1-S023 | Spaces in URLs | issue-emitter | backend/services/audit-parser.service.js:365 |
| P1-S024 | Mixed Case URLs | issue-emitter | backend/services/audit-parser.service.js:376 |
| P1-S025 | URLs Over 115 Characters | issue-emitter | backend/services/audit-parser.service.js:385 |
| P1-S026 | Untracked UTMs Indexed | issue-emitter | backend/services/audit-parser.service.js:393 |
| P1-S027 | Structured Data Errors | issue-emitter | backend/services/audit-parser.service.js:413 |
| P1-S028 | Structured Data Warnings | issue-emitter | backend/services/audit-parser.service.js:421 |
| P1-S029 | Structured Data Validation Errors | issue-emitter | backend/services/audit-parser.service.js:440 |
| P1-S030 | Structured Data Validation Warnings | issue-emitter | backend/services/audit-parser.service.js:453 |

## Priority 2 (46 signals)

| signal_id | name | type | file:line |
|---|---|---|---|
| P2-S001 | gsc route /auth | service-function | backend/routes/gsc.js:31 |
| P2-S002 | gsc route /callback | service-function | backend/routes/gsc.js:51 |
| P2-S003 | gsc route /status | service-function | backend/routes/gsc.js:109 |
| P2-S004 | gsc route /disconnect | service-function | backend/routes/gsc.js:119 |
| P2-S005 | gsc route /properties | service-function | backend/routes/gsc.js:127 |
| P2-S006 | gsc route /:siteId/summary | service-function | backend/routes/gsc.js:165 |
| P2-S007 | gsc route /:siteId/queries | service-function | backend/routes/gsc.js:204 |
| P2-S008 | gsc route /:siteId/pages | service-function | backend/routes/gsc.js:234 |
| P2-S009 | access_type | service-function | backend/routes/gsc.js:42 |
| P2-S010 | prompt | service-function | backend/routes/gsc.js:43 |
| P2-S011 | scope | service-function | backend/routes/gsc.js:44 |
| P2-S012 | state | service-function | backend/routes/gsc.js:45 |
| P2-S013 | access_token | service-function | backend/routes/gsc.js:139 |
| P2-S014 | refresh_token | service-function | backend/routes/gsc.js:140 |
| P2-S015 | expiry_date | service-function | backend/routes/gsc.js:141 |
| P2-S016 | url | service-function | backend/routes/gsc.js:154 |
| P2-S017 | permission_level | service-function | backend/routes/gsc.js:155 |
| P2-S018 | clicks | service-function | backend/routes/gsc.js:194 |
| P2-S019 | impressions | service-function | backend/routes/gsc.js:195 |
| P2-S020 | ctr | service-function | backend/routes/gsc.js:196 |
| P2-S021 | position | service-function | backend/routes/gsc.js:197 |
| P2-S022 | clicks_delta | service-function | backend/routes/gsc.js:198 |
| P2-S023 | impressions_delta | service-function | backend/routes/gsc.js:199 |
| P2-S024 | ga4 route /auth | service-function | backend/routes/ga4.js:31 |
| P2-S025 | ga4 route /callback | service-function | backend/routes/ga4.js:49 |
| P2-S026 | ga4 route /status | service-function | backend/routes/ga4.js:107 |
| P2-S027 | ga4 route /disconnect | service-function | backend/routes/ga4.js:117 |
| P2-S028 | ga4 route /properties | service-function | backend/routes/ga4.js:125 |
| P2-S029 | ga4 route /:siteId/summary | service-function | backend/routes/ga4.js:164 |
| P2-S030 | ga4 route /:siteId/pages | service-function | backend/routes/ga4.js:186 |
| P2-S031 | access_type | service-function | backend/routes/ga4.js:40 |
| P2-S032 | prompt | service-function | backend/routes/ga4.js:41 |
| P2-S033 | scope | service-function | backend/routes/ga4.js:42 |
| P2-S034 | state | service-function | backend/routes/ga4.js:43 |
| P2-S035 | access_token | service-function | backend/routes/ga4.js:137 |
| P2-S036 | refresh_token | service-function | backend/routes/ga4.js:138 |
| P2-S037 | expiry_date | service-function | backend/routes/ga4.js:139 |
| P2-S038 | name | service-function | backend/routes/ga4.js:152 |
| P2-S039 | display_name | service-function | backend/routes/ga4.js:153 |
| P2-S040 | property_id | service-function | backend/routes/ga4.js:154 |
| P2-S041 | psi route /analyze | service-function | backend/routes/psi.js:17 |
| P2-S042 | error | service-function | backend/routes/psi.js:40 |
| P2-S043 | analyzed_at | service-function | backend/routes/psi.js:99 |
| P2-S044 | fetchUrlsFromSitemaps | service-function | backend/services/sitemap-fetcher.js:129 |
| P2-S045 | signal | service-function | backend/services/sitemap-fetcher.js:36 |
| P2-S046 | headers | service-function | backend/services/sitemap-fetcher.js:37 |

## Priority 3 (131 signals)

| signal_id | name | type | file:line |
|---|---|---|---|
| P3-S001 | extractCanonical | extractor-field | playwright-crawler/src/extractors/canonical.js:136 |
| P3-S002 | canonical1 | extractor-field | playwright-crawler/src/extractors/canonical.js:47 |
| P3-S003 | canonical2 | extractor-field | playwright-crawler/src/extractors/canonical.js:48 |
| P3-S004 | count | extractor-field | playwright-crawler/src/extractors/canonical.js:49 |
| P3-S005 | isOutsideHead | extractor-field | playwright-crawler/src/extractors/canonical.js:50 |
| P3-S006 | _canonicalIsRelative | extractor-field | playwright-crawler/src/extractors/canonical.js:110 |
| P3-S007 | _canonicalHasFragment | extractor-field | playwright-crawler/src/extractors/canonical.js:113 |
| P3-S008 | _canonicalCount | extractor-field | playwright-crawler/src/extractors/canonical.js:167 |
| P3-S009 | _canonicalOutsideHead | extractor-field | playwright-crawler/src/extractors/canonical.js:168 |
| P3-S010 | _multipleCanonicals | extractor-field | playwright-crawler/src/extractors/canonical.js:169 |
| P3-S011 | _hreflangTags | extractor-field | playwright-crawler/src/extractors/canonical.js:170 |
| P3-S012 | _hasHreflang | extractor-field | playwright-crawler/src/extractors/canonical.js:171 |
| P3-S013 | extractContent | extractor-field | playwright-crawler/src/extractors/content.js:159 |
| P3-S014 | _wordCount | extractor-field | playwright-crawler/src/extractors/content.js:221 |
| P3-S015 | _mainWordCount | extractor-field | playwright-crawler/src/extractors/content.js:222 |
| P3-S016 | _boilerplateWords | extractor-field | playwright-crawler/src/extractors/content.js:223 |
| P3-S017 | _textRatio | extractor-field | playwright-crawler/src/extractors/content.js:224 |
| P3-S018 | _sizeBytes | extractor-field | playwright-crawler/src/extractors/content.js:225 |
| P3-S019 | _templateDominant | extractor-field | playwright-crawler/src/extractors/content.js:226 |
| P3-S020 | _thinContent | extractor-field | playwright-crawler/src/extractors/content.js:227 |
| P3-S021 | _keywordStuffing | extractor-field | playwright-crawler/src/extractors/content.js:228 |
| P3-S022 | _multipleHeads | extractor-field | playwright-crawler/src/extractors/content.js:231 |
| P3-S023 | extractHeadings | extractor-field | playwright-crawler/src/extractors/headings.js:106 |
| P3-S024 | _allHeadings | extractor-field | playwright-crawler/src/extractors/headings.js:46 |
| P3-S025 | _h1Missing | extractor-field | playwright-crawler/src/extractors/headings.js:146 |
| P3-S026 | _multipleH1s | extractor-field | playwright-crawler/src/extractors/headings.js:147 |
| P3-S027 | _h2Missing | extractor-field | playwright-crawler/src/extractors/headings.js:148 |
| P3-S028 | _h2Overstuffed | extractor-field | playwright-crawler/src/extractors/headings.js:149 |
| P3-S029 | _hiddenHeadings | extractor-field | playwright-crawler/src/extractors/headings.js:150 |
| P3-S030 | _brokenHierarchy | extractor-field | playwright-crawler/src/extractors/headings.js:151 |
| P3-S031 | _allH1s | extractor-field | playwright-crawler/src/extractors/headings.js:152 |
| P3-S032 | _allH2s | extractor-field | playwright-crawler/src/extractors/headings.js:153 |
| P3-S033 | extractImages | extractor-field | playwright-crawler/src/extractors/images.js:54 |
| P3-S034 | _format | extractor-field | playwright-crawler/src/extractors/images.js:96 |
| P3-S035 | _isWebP | extractor-field | playwright-crawler/src/extractors/images.js:97 |
| P3-S036 | _isLazy | extractor-field | playwright-crawler/src/extractors/images.js:98 |
| P3-S037 | _width | extractor-field | playwright-crawler/src/extractors/images.js:99 |
| P3-S038 | _height | extractor-field | playwright-crawler/src/extractors/images.js:100 |
| P3-S039 | _images | extractor-field | playwright-crawler/src/extractors/images.js:113 |
| P3-S040 | _imageCount | extractor-field | playwright-crawler/src/extractors/images.js:114 |
| P3-S041 | _missingAltCount | extractor-field | playwright-crawler/src/extractors/images.js:115 |
| P3-S042 | _altTooLongCount | extractor-field | playwright-crawler/src/extractors/images.js:116 |
| P3-S043 | _noWebPCount | extractor-field | playwright-crawler/src/extractors/images.js:117 |
| P3-S044 | _lazyLoadErrors | extractor-field | playwright-crawler/src/extractors/images.js:118 |
| P3-S045 | extractLinks | extractor-field | playwright-crawler/src/extractors/links.js:28 |
| P3-S046 | href | extractor-field | playwright-crawler/src/extractors/links.js:51 |
| P3-S047 | _internalLinks | extractor-field | playwright-crawler/src/extractors/links.js:82 |
| P3-S048 | _externalLinks | extractor-field | playwright-crawler/src/extractors/links.js:83 |
| P3-S049 | _internalFollowUrls | extractor-field | playwright-crawler/src/extractors/links.js:84 |
| P3-S050 | _hasInternalSearch | extractor-field | playwright-crawler/src/extractors/links.js:85 |
| P3-S051 | _totalLinks | extractor-field | playwright-crawler/src/extractors/links.js:86 |
| P3-S052 | extractMeta | extractor-field | playwright-crawler/src/extractors/meta.js:222 |
| P3-S053 | _titleOutsideHead | extractor-field | playwright-crawler/src/extractors/meta.js:239 |
| P3-S054 | _multipleTitles | extractor-field | playwright-crawler/src/extractors/meta.js:240 |
| P3-S055 | _multipleMetaDescriptions | extractor-field | playwright-crawler/src/extractors/meta.js:241 |
| P3-S056 | extractResources | extractor-field | playwright-crawler/src/extractors/resources.js:283 |
| P3-S057 | src | extractor-field | playwright-crawler/src/extractors/resources.js:148 |
| P3-S058 | type | extractor-field | playwright-crawler/src/extractors/resources.js:149 |
| P3-S059 | async | extractor-field | playwright-crawler/src/extractors/resources.js:151 |
| P3-S060 | inline | extractor-field | playwright-crawler/src/extractors/resources.js:153 |
| P3-S061 | vendor | extractor-field | playwright-crawler/src/extractors/resources.js:157 |
| P3-S062 | src | extractor-field | playwright-crawler/src/extractors/resources.js:165 |
| P3-S063 | type | extractor-field | playwright-crawler/src/extractors/resources.js:166 |
| P3-S064 | defer | extractor-field | playwright-crawler/src/extractors/resources.js:167 |
| P3-S065 | async | extractor-field | playwright-crawler/src/extractors/resources.js:168 |
| P3-S066 | inHead | extractor-field | playwright-crawler/src/extractors/resources.js:169 |
| P3-S067 | inline | extractor-field | playwright-crawler/src/extractors/resources.js:170 |
| P3-S068 | isBlocking | extractor-field | playwright-crawler/src/extractors/resources.js:171 |
| P3-S069 | firstParty | extractor-field | playwright-crawler/src/extractors/resources.js:172 |
| P3-S070 | category | extractor-field | playwright-crawler/src/extractors/resources.js:173 |
| P3-S071 | vendor | extractor-field | playwright-crawler/src/extractors/resources.js:174 |
| P3-S072 | verdict | extractor-field | playwright-crawler/src/extractors/resources.js:175 |
| P3-S073 | size | extractor-field | playwright-crawler/src/extractors/resources.js:176 |
| P3-S074 | src | extractor-field | playwright-crawler/src/extractors/resources.js:212 |
| P3-S075 | type | extractor-field | playwright-crawler/src/extractors/resources.js:213 |
| P3-S076 | inHead | extractor-field | playwright-crawler/src/extractors/resources.js:215 |
| P3-S077 | inline | extractor-field | playwright-crawler/src/extractors/resources.js:216 |
| P3-S078 | category | extractor-field | playwright-crawler/src/extractors/resources.js:219 |
| P3-S079 | vendor | extractor-field | playwright-crawler/src/extractors/resources.js:220 |
| P3-S080 | verdict | extractor-field | playwright-crawler/src/extractors/resources.js:221 |
| P3-S081 | src | extractor-field | playwright-crawler/src/extractors/resources.js:249 |
| P3-S082 | type | extractor-field | playwright-crawler/src/extractors/resources.js:250 |
| P3-S083 | firstParty | extractor-field | playwright-crawler/src/extractors/resources.js:252 |
| P3-S084 | category | extractor-field | playwright-crawler/src/extractors/resources.js:253 |
| P3-S085 | vendor | extractor-field | playwright-crawler/src/extractors/resources.js:254 |
| P3-S086 | verdict | extractor-field | playwright-crawler/src/extractors/resources.js:255 |
| P3-S087 | _resources | extractor-field | playwright-crawler/src/extractors/resources.js:306 |
| P3-S088 | _scripts | extractor-field | playwright-crawler/src/extractors/resources.js:307 |
| P3-S089 | _stylesheets | extractor-field | playwright-crawler/src/extractors/resources.js:308 |
| P3-S090 | _fonts | extractor-field | playwright-crawler/src/extractors/resources.js:309 |
| P3-S091 | _resourceCount | extractor-field | playwright-crawler/src/extractors/resources.js:310 |
| P3-S092 | _blockingCount | extractor-field | playwright-crawler/src/extractors/resources.js:311 |
| P3-S093 | _thirdPartyCount | extractor-field | playwright-crawler/src/extractors/resources.js:312 |
| P3-S094 | _tagManagerCount | extractor-field | playwright-crawler/src/extractors/resources.js:313 |
| P3-S095 | _trackingCount | extractor-field | playwright-crawler/src/extractors/resources.js:314 |
| P3-S096 | _safeToBlockCount | extractor-field | playwright-crawler/src/extractors/resources.js:315 |
| P3-S097 | _renderBlocking | extractor-field | playwright-crawler/src/extractors/resources.js:316 |
| P3-S098 | _excessiveTracking | extractor-field | playwright-crawler/src/extractors/resources.js:317 |
| P3-S099 | _multipleTagManagers | extractor-field | playwright-crawler/src/extractors/resources.js:318 |
| P3-S100 | deriveIndexability | extractor-field | playwright-crawler/src/extractors/response.js:79 |
| P3-S101 | extractResponse | extractor-field | playwright-crawler/src/extractors/response.js:116 |
| P3-S102 | indexability | extractor-field | playwright-crawler/src/extractors/response.js:84 |
| P3-S103 | indexabilityStatus | extractor-field | playwright-crawler/src/extractors/response.js:85 |
| P3-S104 | indexability | extractor-field | playwright-crawler/src/extractors/response.js:93 |
| P3-S105 | indexabilityStatus | extractor-field | playwright-crawler/src/extractors/response.js:94 |
| P3-S106 | indexability | extractor-field | playwright-crawler/src/extractors/response.js:99 |
| P3-S107 | indexabilityStatus | extractor-field | playwright-crawler/src/extractors/response.js:100 |
| P3-S108 | _isHttps | extractor-field | playwright-crawler/src/extractors/response.js:165 |
| P3-S109 | _redirectChain | extractor-field | playwright-crawler/src/extractors/response.js:166 |
| P3-S110 | extractSchema | extractor-field | playwright-crawler/src/extractors/schema.js:155 |
| P3-S111 | _parseError | extractor-field | playwright-crawler/src/extractors/schema.js:183 |
| P3-S112 | _raw | extractor-field | playwright-crawler/src/extractors/schema.js:184 |
| P3-S113 | _type | extractor-field | playwright-crawler/src/extractors/schema.js:209 |
| P3-S114 | _isRichResult | extractor-field | playwright-crawler/src/extractors/schema.js:210 |
| P3-S115 | _errors | extractor-field | playwright-crawler/src/extractors/schema.js:211 |
| P3-S116 | _warnings | extractor-field | playwright-crawler/src/extractors/schema.js:212 |
| P3-S117 | _properties | extractor-field | playwright-crawler/src/extractors/schema.js:213 |
| P3-S118 | _raw | extractor-field | playwright-crawler/src/extractors/schema.js:214 |
| P3-S119 | _schemaItems | extractor-field | playwright-crawler/src/extractors/schema.js:232 |
| P3-S120 | _schemaTypes | extractor-field | playwright-crawler/src/extractors/schema.js:233 |
| P3-S121 | _schemaErrors | extractor-field | playwright-crawler/src/extractors/schema.js:234 |
| P3-S122 | _schemaWarnings | extractor-field | playwright-crawler/src/extractors/schema.js:235 |
| P3-S123 | _schemaCount | extractor-field | playwright-crawler/src/extractors/schema.js:236 |
| P3-S124 | _parseErrors | extractor-field | playwright-crawler/src/extractors/schema.js:237 |
| P3-S125 | _hasOrganization | extractor-field | playwright-crawler/src/extractors/schema.js:240 |
| P3-S126 | _hasBreadcrumb | extractor-field | playwright-crawler/src/extractors/schema.js:241 |
| P3-S127 | _hasProduct | extractor-field | playwright-crawler/src/extractors/schema.js:242 |
| P3-S128 | _hasFAQ | extractor-field | playwright-crawler/src/extractors/schema.js:243 |
| P3-S129 | _hasLocalBusiness | extractor-field | playwright-crawler/src/extractors/schema.js:244 |
| P3-S130 | _hasWebSite | extractor-field | playwright-crawler/src/extractors/schema.js:245 |
| P3-S131 | _hasArticle | extractor-field | playwright-crawler/src/extractors/schema.js:246 |

## Priority 4 (6 signals)

| signal_id | name | type | file:line |
|---|---|---|---|
| P4-S001 | crawl | service-function | playwright-crawler/src/crawler.js:198 |
| P4-S002 | getJobUrlBuffer | service-function | backend/services/crawl-runner.js:34 |
| P4-S003 | resetStuckJobs | service-function | backend/services/crawl-runner.js:45 |
| P4-S004 | startCrawl | service-function | backend/services/crawl-runner.js:68 |
| P4-S005 | cancelCrawl | service-function | backend/services/crawl-runner.js:260 |
| P4-S006 | CRAWL_DATA_DIR | service-function | backend/services/crawl-runner.js:20 |
