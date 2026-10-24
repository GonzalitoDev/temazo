import { createClient } from "@supabase/supabase-js";

// Mismo proyecto que tus otras apps (tablas con prefijo temazo_). La publishable key es pública
// por diseño; lo que protege los datos es RLS. Se puede pisar con NEXT_PUBLIC_SUPABASE_URL / _KEY.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xfwolaurpeofysnymqle.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY || "sb_publishable_3VvBUD5Bdu3Uaq59fJ99MQ_XDCtujUU";

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 10 } },
});
