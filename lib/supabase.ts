import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/**
 * Server-side Supabase client using the project's publishable (anon) key.
 * The waitlist table only allows INSERT for this key (see supabase/migrations).
 * Accepts the names set by hand (.env.example) and by Vercel's Supabase integration.
 * Returns null when nothing is set, so local dev still works.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const env = process.env;
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.SUPABASE_ANON_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}
