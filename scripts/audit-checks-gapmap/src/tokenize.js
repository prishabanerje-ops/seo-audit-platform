import { normalizeName } from './normalize.js';
import { splitCamelCase, expandAcronyms } from './acronym.js';

const STOPWORDS = new Set([
  'a','an','the','and','or','of','for','to','in','on','at','is','be','with','by',
]);

export function tokenize(s) {
  if (s == null) return new Set();
  // Order matters: split camelCase BEFORE normalizing, so case info is preserved
  const split = splitCamelCase(String(s));
  const expanded = expandAcronyms(split);
  const normalized = normalizeName(expanded);
  return new Set(
    normalized.split(' ').filter(t => t && !STOPWORDS.has(t)),
  );
}
