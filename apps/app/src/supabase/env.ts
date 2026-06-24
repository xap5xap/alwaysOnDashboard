// Supabase connection from the Expo public env (EXPO_PUBLIC_* are inlined at build time). For local
// dev set these in apps/app/.env from `supabase status` (see .env.example). Empty values mean the
// app is unconfigured and the sign-in screen shows a setup hint instead of crashing.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
