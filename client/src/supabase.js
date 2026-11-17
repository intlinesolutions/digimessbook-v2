import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const passwordRecoveryStorageKey = 'digimessbook:password-recovery';

if (supabase && typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') {
      try {
        window.sessionStorage.setItem(passwordRecoveryStorageKey, 'true');
      } catch {
        // The recovery listener in the app also handles the event directly.
      }
    }
  });
}
