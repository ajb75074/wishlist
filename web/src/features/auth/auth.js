import { supabase } from "../../lib/supabase";

// A fixed, configured origin rather than window.location.origin - the
// extension's own bundled copy of this app would otherwise leak a
// chrome-extension:// URL into the recovery email.
const PASSWORD_RESET_REDIRECT_URL = `${import.meta.env.VITE_APP_URL}/#/reset-password`;

export const MIN_PASSWORD_LENGTH = 6;

// resetPasswordForEmail never reveals whether the email is registered; only a
// genuine send failure surfaces here.
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: PASSWORD_RESET_REDIRECT_URL,
  });

  if (error) {
    return { success: false, isRateLimited: error.status === 429 };
  }

  return { success: true };
}

// Implicit flow: recovery links carry access_token/refresh_token directly
// rather than a PKCE code.
export async function completePasswordRecovery({ accessToken, refreshToken }) {
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return { success: !error };
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { success: false, error: error.message || "Could not update your password. Please try again." };
  }

  return { success: true };
}

// Verifies the CURRENT password by attempting a real sign-in - Supabase has
// no standalone "check this password" endpoint.
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
