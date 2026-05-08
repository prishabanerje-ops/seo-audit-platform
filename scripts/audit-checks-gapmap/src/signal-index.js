import { extractParserSignals } from './extract/parser.js';
import { extractIntegrationSignals } from './extract/integration.js';
import { extractCrawlerExtractorSignals } from './extract/crawler-extractors.js';
import { extractMiscSignals } from './extract/misc.js';

export async function buildSignalIndex() {
  const [p1, p2, p3, p4] = await Promise.all([
    extractParserSignals(),
    extractIntegrationSignals(),
    extractCrawlerExtractorSignals(),
    extractMiscSignals(),
  ]);
  return [...p1, ...p2, ...p3, ...p4];
}
