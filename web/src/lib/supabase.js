import { createClient } from "@supabase/supabase-js";
import { chromeStorageAdapter, isChromeExtensionContext } from "./chromeStorageAdapter";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Supabase environment variables are missing.");
}

// In extension context, back session persistence with chrome.storage.local
// instead of the default localStorage - this is what lets a session
// started on this same page (running as chrome-extension://.../wishlist/
// index.html) later be read by the rest of the extension (e.g. the
// popup). On plain web (including local Vite dev), omit `storage`
// entirely so supabase-js falls back to its own normal localStorage
// default untouched.
//
// detectSessionInUrl is off everywhere: this app never uses magic
// links/OAuth redirects, and the URL hash is already used for in-app
// routing (HashRouter, e.g. #/collections/irish) - leaving Supabase's
// own hash-scanning on risks it misreading a route as an auth callback.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    ...(isChromeExtensionContext() ? { storage: chromeStorageAdapter } : {}),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
