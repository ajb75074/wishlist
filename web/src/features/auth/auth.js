import { supabase } from "../../lib/supabase";

// Deliberately a fixed, explicitly configured origin rather than
// window.location.origin - this must always be a normal web URL, even
// if "forgot password" is somehow triggered from inside the extension's
// own bundled copy of this app (window.location.origin there would be
// chrome-extension://..., which a password recovery email must never
// point at). See web/.env.example for what this needs to be set to per
// environment.
const PASSWORD_RESET_REDIRECT_URL = `${import.meta.env.VITE_APP_URL}/#/reset-password`;

export const MIN_PASSWORD_LENGTH = 6;

// Supabase's own resetPasswordForEmail already never reveals whether
// the email is registered - both "sent" and "no such account" resolve
// here identically. Only a genuine send failure (rate limit, network)
// is distinguished, and only so the user knows to actually retry -
// never in a way that depends on account existence.
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: PASSWORD_RESET_REDIRECT_URL,
  });

  if (error) {
    return { success: false, isRateLimited: error.status === 429 };
  }

  return { success: true };
}

// This project's installed @supabase/auth-js (2.112.4) defaults
// flowType to "implicit" (confirmed by reading GoTrueClient.js's own
// DEFAULT_OPTIONS - web/src/lib/supabase.js never sets flowType, so
// that default is what's actually in effect). Implicit-flow recovery
// links carry access_token/refresh_token/type directly in the URL
// rather than a PKCE code, so this establishes the session with the
// official setSession API using exactly those two values -
// ResetPasswordScreen is responsible for parsing them safely out of
// the URL and verifying type=recovery before ever calling this.
// setSession persists via whichever storage adapter supabase.js is
// already configured with (localStorage on web, chrome.storage.local
// inside the extension) - nothing here writes storage directly.
export async function completePasswordRecovery({ accessToken, refreshToken }) {
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return { success: !error };
}

// Shared by both the recovery flow (ResetPasswordScreen) and the
// authenticated flow (Profile's ChangePasswordModal) - Supabase Auth is
// the sole owner of password storage either way, this just wraps
// updateUser with one place to fall back to a friendly message.
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { success: false, error: error.message || "Could not update your password. Please try again." };
  }

  return { success: true };
}

// Profile's "change password" flow, which - unlike the recovery flow
// above - requires proving the CURRENT password first. Supabase's
// client SDK has no standalone "check this password" endpoint (that
// would itself be a security-sensitive oracle); the only
// Supabase-supported way to verify one is to attempt a real sign-in
// with it. This never reads, stores, or compares the password itself -
// Supabase Auth alone decides whether it matches.
//
// Session implications, confirmed by reading the installed
// @supabase/auth-js source (signInWithPassword's implementation) rather
// than assumed:
// - On a WRONG current password, the POST to /token?grant_type=password
//   itself fails and signInWithPassword returns an error WITHOUT ever
//   calling _saveSession/_notifyAllSubscribers - the existing session
//   in storage and in AuthContext is left completely untouched. A
//   failed verification attempt cannot corrupt or sign the user out of
//   their current session.
// - On a CORRECT current password, this is a real sign-in for the SAME
//   account (same email, and the password had to match), so Supabase
//   issues a fresh access/refresh token pair, overwrites the stored
//   session via the already-configured storage adapter (localStorage on
//   web, chrome.storage.local in the extension - nothing manual here),
//   and emits a normal SIGNED_IN event. AuthContext's existing
//   onAuthStateChange listener already picks this up the same way it
//   handles any other SIGNED_IN event, keeping `session`/`user` in
//   sync automatically - no changes needed there. The user never
//   appears signed out at any point; they simply end up with a newer,
//   equally valid session for the same identity.
export async function changePassword({ email, currentPassword, newPassword }) {
  let verification;
  try {
    verification = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  } catch {
    return { success: false, error: "Couldn't verify your password. Check your connection and try again." };
  }

  if (verification.error) {
    return { success: false, error: "Current password is incorrect." };
  }

  return updatePassword(newPassword);
}
