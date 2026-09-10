// verify_jwt only proves the request carries some validly-signed Supabase JWT
// - the anon key is one too. This resolves the token to a real user.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@^2";

export interface AuthResult {
  user: { id: string };
  supabase: SupabaseClient;
}

export async function requireUser(req: Request): Promise<AuthResult | Response> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return unauthorized("Missing Authorization header.");
  }

  const token = authHeader.slice("Bearer ".length);

  // Provided automatically inside every Edge Function - no new secret
  // needs to be configured for this.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    console.error("requireUser: SUPABASE_URL/SUPABASE_ANON_KEY not configured.");
    return jsonResponse({ error: "Server misconfiguration." }, 500);
  }

  // Built with the CALLER's own token, never service_role, so every query
  // stays subject to RLS.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    // Anon key, expired, malformed, and revoked tokens all collapse to one
    // clean 401.
    return unauthorized("Sign in required.");
  }

  return { user: { id: data.user.id }, supabase };
}

function unauthorized(message: string): Response {
  return jsonResponse({ error: message }, 401);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
