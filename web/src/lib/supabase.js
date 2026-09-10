import { createClient } from "@supabase/supabase-js";
import { chromeStorageAdapter, isChromeExtensionContext } from "./chromeStorageAdapter";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Supabase environment variables are missing.");
}

// Extension context stores the session in chrome.storage.local so the popup
// can read it. detectSessionInUrl is off because HashRouter already owns the
// hash.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    ...(isChromeExtensionContext() ? { storage: chromeStorageAdapter } : {}),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
