import { normalizeName } from './normalize.js';

const STOPWORDS = new Set([
  'a','an','the','and','or','of','for','to','in','on','at','is','be','with','by',
]);

function tokenize(s) {
  return new Set(
    normalizeName(s)
      .split(' ')
      .filter(t => t && !STOPWORDS.has(t)),
  );
}

export function tokenOverlap(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

