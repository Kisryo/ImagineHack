import { createClient } from "@supabase/supabase-js";

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
};

export const isSupabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.publishableKey);
export const allowLocalFallback = import.meta.env.VITE_ALLOW_LOCAL_FALLBACK === "true";
export const localFallbackPassword = import.meta.env.VITE_LOCAL_FALLBACK_PASSWORD;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.publishableKey)
  : null;
