// Prepare Piece needs to read pixel data (canvas getImageData/toBlob) from
// a retailer's product image. That only works in the browser if the
// retailer's own server sends CORS headers - most don't (self-hosted
// WordPress/WooCommerce sites in particular). This function fetches the
// image server-side (CORS is a browser-only restriction, not a
// server-to-server one) and re-serves the same bytes with permissive
// CORS headers attached, so the browser can read them regardless of
// what the original host does or doesn't send.
//
// Auth: left at the default (verify_jwt = true), so this is invoked the
// same way every other Supabase call in this app already is - with the
// project's anon/publishable key as the Bearer token. No new, weaker
// security posture; no service-role key involved.
//
// This never redraws/regenerates image content - it's a byte-for-byte
// passthrough of whatever the source server returns.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const targetUrl = new URL(req.url).searchParams.get("url");

  if (!targetUrl) {
    return new Response("Missing 'url' query parameter.", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return new Response("Invalid 'url' query parameter.", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return new Response("Only http/https URLs are allowed.", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(parsedUrl.toString());
  } catch {
    return new Response("Could not reach the source image.", {
      status: 502,
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

  return new Response(upstreamResponse.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": contentType,
    },
  });
});
