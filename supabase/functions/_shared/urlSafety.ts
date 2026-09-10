// SSRF protections for any function that fetches a client-influenced URL:
// scheme and host checks, private-range rejection, manual redirect handling,
// timeouts, and size caps.

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

// Best-effort: a failure means "could not confirm via DNS", not "safe". Only
// ever used to reject.
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

// redirect: "manual" is deliberate - a URL that passed the safety check could
// still redirect to an internal address, so any 3xx is a rejection.
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
