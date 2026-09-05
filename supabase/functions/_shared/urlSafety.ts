// SSRF protections for any function that fetches a client-influenced
// URL. image-proxy uses this directly; illustrate-look no longer needs
// to fetch client-supplied URLs at all (see its own file), but this
// module is written to be safe for either.
//
// LAYERED APPROACH - read this before changing the limitation notes below:
//
// 1. Literal checks (hostname string match + literal IP parsing) -
//    zero runtime dependency, always active, cannot fail or degrade.
//    This alone blocks every non-DNS-rebinding case: a literal private
//    IP, loopback, link-local, or metadata-hostname supplied directly.
//
// 2. A DNS-resolution check via Deno.resolveDns(), layered on top as
//    defense-in-depth. This was NOT blindly assumed - Deno.resolveDns
//    is confirmed present as a real API on the Deno object inside
//    Supabase's actual edge-runtime (verified against a
//    supabase/edge-runtime GitHub issue that logs the runtime's own
//    Deno object, not just Deno Deploy's own docs, which separately
//    document it as a stable, available API there too - and Supabase's
//    own docs state edge-runtime intentionally mirrors the Deno Deploy
//    API surface). It could not be verified to actually SUCCEED inside
//    the real deployed sandbox from this environment (no Docker
//    available locally to run `supabase functions serve` against the
//    real edge-runtime image, and deploying was out of scope for this
//    task) - so it's wrapped to degrade gracefully: if it throws or is
//    ever unavailable, that is logged server-side and treated as
//    "could not confirm via DNS", never as a crash and never by
//    blocking all traffic. Layer 1's guarantees do not depend on layer
//    2 succeeding.
//
// REMAINING LIMITATION, stated plainly: even with both layers active,
// this does not fully close a determined DNS-rebinding attack (resolve
// to a public address for our check, then have DNS answer a private
// address by the time fetch() performs its own separate resolution
// moments later). Fully closing that gap means fetching over a
// pre-resolved, pinned IP with the Host header set manually by hand -
// real added complexity this project's threat model doesn't currently
// justify.

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 10 || // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local, includes 169.254.169.254 metadata
    a === 0 // "this network"
  );
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "::1" || // loopback
    normalized === "::" || // unspecified
    normalized.startsWith("fe80:") || // link-local
    normalized.startsWith("fc") || // unique local fc00::/7
    normalized.startsWith("fd")
  );
}

function isLiteralPrivateAddress(hostname: string): boolean {
  return isPrivateIPv4(hostname) || isPrivateIPv6(hostname);
}

// Best-effort only - see module header. Never throws; a failure here
// means "could not confirm via DNS", not "confirmed safe" - callers
// only ever use this to REJECT (a true result), never to approve a URL
// the literal check would otherwise have blocked.
async function resolvesToPrivateAddress(hostname: string): Promise<boolean> {
  try {
    const [v4, v6] = await Promise.all([
      Deno.resolveDns(hostname, "A").catch(() => [] as string[]),
      Deno.resolveDns(hostname, "AAAA").catch(() => [] as string[]),
    ]);
    return v4.some(isPrivateIPv4) || v6.some(isPrivateIPv6);
  } catch (error) {
    console.warn(
      "urlSafety: Deno.resolveDns unavailable or failed - proceeding on literal checks only.",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed.");
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname) || isLiteralPrivateAddress(hostname)) {
    throw new Error("This URL cannot be fetched.");
  }

  if (await resolvesToPrivateAddress(hostname)) {
    throw new Error("This URL cannot be fetched.");
  }

  return url;
}

const FETCH_TIMEOUT_MS = 8000;
export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024; // 8MB - generous for a product photo

// redirect: "manual" is deliberate - a URL that passed assertSafeUrl
// could still redirect to an internal address, so any 3xx is treated
// as a rejection rather than silently followed. This was kept as
// specified even though real stored retailer image URLs could not be
// tested against this behavior from this environment (no live DB
// access and no example URLs found anywhere in the repo) - see the
// accompanying report for what to verify after this deploys.
export async function safeFetch(rawUrl: string): Promise<Response> {
  const url = await assertSafeUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { redirect: "manual", signal: controller.signal });

    if (response.status >= 300 && response.status < 400) {
      throw new Error("Redirects are not allowed.");
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
      throw new Error("Image is too large.");
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// Enforces MAX_RESPONSE_BYTES on the actual bytes read, not just the
// (optional, sometimes-understated) Content-Length header.
export async function readBodyWithLimit(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RESPONSE_BYTES) {
      throw new Error("Image is too large.");
    }
    return new Uint8Array(buffer);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Image is too large.");
    }

    chunks.push(value);
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
