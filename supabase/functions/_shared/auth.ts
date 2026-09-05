// Shared "require a real signed-in user" check for every Edge Function
// in this project. The platform's own verify_jwt gateway setting only
// confirms a request carries *some* validly-signed Supabase JWT - the
// anon/publishable key is itself exactly such a JWT (role: anon, no
// sub claim), so it passes that gate too. This is the actual
// authorization decision: resolving the token to a real authenticated
// user via Supabase Auth itself, which the anon key can never do.
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

  // A client built with the CALLER's own token, never service_role -
  // any query made with this client is subject to the same table RLS
  // the rest of the app already relies on, so callers get
  // ownership-safe DB access for free instead of the function
  // re-implementing ownership checks by hand.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    // Covers: anon key (no resolvable user), expired token, malformed
    // token, revoked session - all collapse to the same clean 401.
    // Never logs the token or echoes the underlying error detail to
    // the client.
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
