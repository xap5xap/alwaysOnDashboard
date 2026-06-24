// The single supabase-js client (AOD-25: raw supabase-js, no ORM). It owns auth (the session whose
// JWT authenticates every proxy/broker call) and RLS-scoped reads/writes. The session is persisted
// in expo-secure-store on device (the locked on-device home for the JWT, AOD-5/AOD-9); on web
// supabase-js falls back to its default web storage when `storage` is undefined.
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// Fallbacks keep createClient from throwing when unconfigured; the sign-in screen surfaces the real
// setup hint via isSupabaseConfigured (env.ts).
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY || 'public-anon-key',
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
