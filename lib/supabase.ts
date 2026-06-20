import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null;

export const supabaseAdmin: SupabaseClient | null =
  url && service ? createClient(url, service, { auth: { persistSession: false } }) : null;

export const usingSupabase = Boolean(supabase);
