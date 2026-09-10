// Re-serves a retailer image with permissive CORS headers so Prepare Piece
// can read its pixels. Authenticated, SSRF-guarded, and size-capped.
import { requireUser } from "../_shared/auth.ts";
import { assertSafeUrl, readBodyWithLimit } from "../_shared/urlSafety.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const FETCH_TIMEOUT_MS = 8000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed.", { status: 405, headers: CORS_HEADERS });
  }

  const authResult = await requireUser(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const targetUrl = new URL(req.url).searchParams.get("url");

  if (!targetUrl) {
    return new Response("Missing 'url' query parameter.", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  let safeUrl: URL;
  try {
    safeUrl = await assertSafeUrl(targetUrl);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Invalid URL.", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(safeUrl, { redirect: "manual", signal: controller.signal });
  } catch {
    return new Response("Could not reach the source image.", {
      status: 502,
      headers: CORS_HEADERS,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
    return new Response("Redirects are not allowed.", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  if (!upstreamResponse.ok) {
    return new Response("The source image request failed.", {
      status: 502,
      headers: CORS_HEADERS,
    });
  }

  const contentType = upstreamResponse.headers.get("content-type") ?? "";

  // Keeps this a pure image proxy, not a generic URL fetcher.
  if (!contentType.startsWith("image/")) {
    return new Response("The requested resource is not an image.", {
      status: 415,
      headers: CORS_HEADERS,
    });
  }

  let bytes: Uint8Array;
  try {
    bytes = await readBodyWithLimit(upstreamResponse);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Image is too large.", {
      status: 413,
      headers: CORS_HEADERS,
    });
  }

  // Uint8Array is a valid Response body; the cast is only a TS lib typing
  // mismatch.
  return new Response(bytes as BodyInit, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": contentType,
    },
  });
});
