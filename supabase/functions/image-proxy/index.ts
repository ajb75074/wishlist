// Prepare Piece needs to read pixel data (canvas getImageData/toBlob) from
// a retailer's product image. That only works in the browser if the
// retailer's own server sends CORS headers - most don't (self-hosted
// WordPress/WooCommerce sites in particular). This function fetches the
// image server-side (CORS is a browser-only restriction, not a
// server-to-server one) and re-serves the same bytes with permissive
// CORS headers attached, so the browser can read them regardless of
// what the original host does or doesn't send.
//
// AUTH: requires a real authenticated user (requireUser) - the
// project's anon/publishable key alone is no longer sufficient, since
// this function fetches arbitrary client-supplied URLs server-side and
// was otherwise effectively an open proxy to anyone holding the public
// anon key. No service-role key involved.
//
// This never redraws/regenerates image content - it's a byte-for-byte
// passthrough of whatever the source server returns, still gated to
// image/* responses only (never a generic authenticated file proxy).
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

  // Uint8Array is a fully valid Response body per the Fetch spec - this
  // cast is purely a TS lib typing mismatch (BodyInit's declared type
  // here doesn't structurally match Uint8Array's generic ArrayBuffer
  // parameter), not a runtime concern.
  return new Response(bytes as BodyInit, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": contentType,
    },
  });
});
