/**
 * @module lib/url-safety
 *
 * SSRF guard for user-supplied URLs consumed by outbound fetches (crawler,
 * sitemap fetcher). Enforces:
 *   - Scheme allowlist: http, https only
 *   - DNS resolution, then reject private ranges, loopback, link-local
 *   - Rejects URLs whose authority is already a private/loopback literal
 *
 * Use on any URL whose host the user controls.
 */

import { promises as dns } from 'dns';
import net from 'net';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Returns true if the numeric IP is in a block we must not contact:
 *   IPv4: 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 0.0.0.0/8
 *   IPv6: ::1, fc00::/7 (ULA), fe80::/10 (link-local), ::ffff:<v4-private>,
 *         :: and 0::0 (any), 2001:db8::/32 (documentation)
 */
export function isPrivateOrLoopbackIp(ip) {
  if (!ip) return false;
  const v = net.isIP(ip);
  if (v === 4) return isPrivateV4(ip);
  if (v === 6) return isPrivateV6(ip);
  return false;
}

function isPrivateV4(ip) {
  const [a, b] = ip.split('.').map(Number);
  if (a === 10) return true;                       // 10/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true;         // 192.168/16
  if (a === 127) return true;                      // 127/8 loopback
  if (a === 169 && b === 254) return true;         // 169.254/16 link-local + AWS IMDS
  if (a === 0) return true;                        // 0.0.0.0/8 "this network"
  if (a >= 224) return true;                       // multicast + reserved
  return false;
}

function isPrivateV6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::' || lower === '::0') return true;
  // IPv4-mapped (::ffff:a.b.c.d) — check the embedded v4
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  // fc00::/7 (unique local) covers fc00:: and fd00::
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  // fe80::/10 (link-local)
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  // 2001:db8::/32 (documentation) — safe to block, not a real internet target
  if (lower.startsWith('2001:db8:')) return true;
  return false;
}

/**
 * Validate a URL for outbound fetching. Resolves DNS and rejects private ranges.
 * @returns {Promise<{ url: URL, resolvedIps: string[] }>} on success.
 * @throws  {Error} with a short, safe message on failure.
 */
export async function assertSafeOutboundUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error(`URL scheme not allowed: ${url.protocol}`);
  }

  const host = url.hostname;

  // Literal IP in the URL — check directly, skip DNS.
  const ipKind = net.isIP(host);
  if (ipKind !== 0) {
    if (isPrivateOrLoopbackIp(host)) {
      throw new Error('URL points to a private or loopback address');
    }
    return { url, resolvedIps: [host] };
  }

  // DNS resolve — all addresses must be public. Short timeout via AbortSignal
  // isn't supported here, but dns.lookup is fast enough in practice.
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('URL host did not resolve');
  }

  if (!Array.isArray(addrs) || addrs.length === 0) {
    throw new Error('URL host did not resolve');
  }

  for (const { address } of addrs) {
    if (isPrivateOrLoopbackIp(address)) {
      throw new Error('URL host resolves to a private or loopback address');
    }
  }

  return { url, resolvedIps: addrs.map(a => a.address) };
}
