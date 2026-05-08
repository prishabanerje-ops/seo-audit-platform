---
name: Crawl configuration testing checklist
description: When asked to test crawl functionality, always verify config is actually being applied end-to-end — not just that it's saved to the DB
type: feedback
originSessionId: 614154b5-3830-4333-95d9-55542c47fa9e
---
When testing any crawl-related feature or change, always verify the following end-to-end — not just that values are saved in the DB or UI:

1. **Max URL limit is respected** — run a crawl against a site with many pages, confirm SF stops at or near the configured limit (not 3–23× over)
2. **Crawl depth is respected** — run a crawl with depth=1 and confirm SF does not follow links beyond the seed URL's direct children
3. **Config is actually passed to SF CLI** — verify `--config <path>` is in the spawned process args, and the XML config file contains the correct values (`<maxCrawlUrls>`, `<maxCrawlDepth>`, etc.)
4. **Structured data validation** — after a crawl, confirm `structured_data_validation_errors.csv` and `structured_data_validation_warnings.csv` are being read by the parser and surfaced as findings (not just the error/warning *counts* from `structured_data_all.csv`)
5. **All other SF settings** — render mode, threads, JS rendering, custom extraction, robots respect — spot-check that the XML config values map to observable crawl behavior

**Why:** The `patchConfig` function in `sf-config-patcher.js` was written but never wired into `crawl-runner.js`. This meant every crawl ran with SF defaults, silently ignoring all user configuration. This went undetected because testing only verified that config values were saved to the DB, not that they were applied at crawl time.

**How to apply:** Any time I write or modify crawl configuration code, testing must include an actual crawl run with non-default values, with observable verification that those values took effect.
