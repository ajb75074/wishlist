// Illustrate Look's client -> server boundary. Mirrors
// features/wishlist/wishlist.js's fetchProductImageViaProxy - same
// Edge Function invocation convention (VITE_SUPABASE_URL +
// functions/v1/<name>, no service-role key, no provider credentials in
// this bundle at all). The actual Gemini call, prompt, and API key
// live entirely in supabase/functions/illustrate-look/ - this file
// only ever sends the app-level payload IllustrateLookModal builds and
// returns the normalized result.
//
// Authorization is now the signed-in user's own access_token, not the
// publishable key - the function requires a real authenticated user
// and loads the Look's own pieces from the database itself, so the
// publishable key alone is no longer sufficient (it stays in `apikey`,
// which Supabase's gateway still expects on every request).
import { supabase } from "../../lib/supabase";

export async function generateLookIllustration(payload) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { success: false, error: "Please sign in to generate an illustration." };
  }

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/illustrate-look`;

  let response;
  try {
    response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { success: false, error: "Couldn't reach the illustration service. Check your connection and try again." };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { success: false, error: "The illustration service returned an unexpected response." };
  }

  if (!response.ok) {
    return { success: false, error: data?.error || "Couldn't generate an illustration right now." };
  }

  if (!data?.imageDataUrl) {
    return { success: false, error: "The illustration service returned an unexpected response." };
  }

  return { success: true, imageDataUrl: data.imageDataUrl };
}
