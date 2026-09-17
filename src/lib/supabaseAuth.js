import { supabase } from '@/lib/supabaseClient';

// Wrapper semplice attorno a supabase.auth, con la stessa "forma" delle
// chiamate base44.auth.* usate nelle pagine, per rendere minime le modifiche
// nel resto del codice.

export async function isAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data: profile } = await supabase.from('profiles').select('role, image_url, team_slot').eq('id', session.user.id).single();
  return {
    id: session.user.id,
    email: session.user.email,
    full_name: session.user.user_metadata?.full_name || session.user.email,
    role: profile?.role || 'user',
    image_url: profile?.image_url || null,
    team_slot: profile?.team_slot ?? null
  };
}

export async function loginWithPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function loginWithGoogle(redirectTo) {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) throw error;
}

// Registrazione in due passi, come nel flusso originale: 1) invia un codice
// via email, 2) l'utente lo digita e la sessione si apre.
export async function registerWithPassword(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function verifySignupCode(email, otpCode) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
  if (error) throw error;
  return data;
}

export async function resendSignupCode(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

export async function resetPasswordRequest(email, redirectTo) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

// Da usare nella pagina di reset: il link ricevuto via email apre già una
// sessione temporanea di recupero, quindi basta impostare la nuova password.
export async function setNewPassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function updateProfile(patch) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Non autenticato');
  const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id);
  if (error) throw error;
}

export async function logout() {
  await supabase.auth.signOut();
}
