export async function invokeMessAdmin(supabase, action, payload = {}) {
  if (import.meta.env.DEV) {
    if (!supabase) return { data: null, error: { message: 'Supabase is not configured.' } };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { data: null, error: { message: 'Sign in to continue.' } };
    try {
      const response = await fetch('/__mess-admin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await response.json();
      if (!response.ok) return { data: null, error: { message: data.error || 'Unable to complete the request.' } };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error.message || 'Unable to reach the local mess-admin API.' } };
    }
  }
  return supabase.functions.invoke('mess-admin', { body: { action, ...payload } });
}
