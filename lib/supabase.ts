import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";

// ✅ Keys lidas do app.config.ts (extra) — permite rotacionar sem rebuild
const FALLBACK_URL = "https://your-project-url.supabase.co";
const FALLBACK_KEY = "your-anon-key";

export const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || FALLBACK_URL;
export const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || FALLBACK_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    // ✅ CORREÇÃO: detectSessionInUrl APENAS na web
    // No mobile o Supabase tentava reprocessar URLs ao voltar do background
    // causando invalidação da sessão e feed preto
    detectSessionInUrl: Platform.OS === "web",
    // ✅ CORREÇÃO: implicit funciona com AsyncStorage no mobile
    // pkce exige PKCE verifier que se perde quando o app vai para background
    flowType: Platform.OS === "web" ? "pkce" : "implicit",
  },
});
