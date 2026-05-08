import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: { error: 'Rate limit exceeded.' },
});

export const errorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Error reporting rate limit exceeded.' },
  keyGenerator: (req) => req.user?.sub || req.ip,
});

// 10 requests per minute per IP — AI suggestion endpoint
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a minute.' },
});

// 15 requests per minute per IP — PageSpeed Insights endpoint (PSI is slow; legitimate users won't exceed this)
export const psiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many PSI requests. Please wait a minute.' },
});
