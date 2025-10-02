import { createClient } from "@supabase/supabase-js";

let supabase: any = null;

function getSupabaseClient() {
  if (supabase) {
    return supabase;
  }

  const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonkey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseURL) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (!supabaseAnonkey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable");
  }

  supabase = createClient(supabaseURL, supabaseAnonkey);
  return supabase;
}

export default getSupabaseClient;