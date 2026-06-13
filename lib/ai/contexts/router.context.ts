import { supabase } from "@/lib/supabase";
import type { RouterContextData, SessionContext } from "../types";
import { isProfileIncomplete, buildOnboardingContext } from "./onboarding.context";

export async function buildRouterContext(
  professionalId: string,
  recentHistory: RouterContextData["recentHistory"],
  session: SessionContext,
): Promise<RouterContextData> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, business_name, profile_type, specialty, bio, business_hours, whatsapp, offered_services")
    .eq("id", professionalId)
    .single();

  const p = profile as any;

  // Determinar se o perfil está completo
  const profileComplete = !!(p?.specialty && p?.business_hours && p?.whatsapp && p?.offered_services);

  return {
    professional: {
      name: p?.business_name || p?.display_name || "Profissional",
      profile_type: p?.profile_type || "professional",
      specialty: p?.specialty || "",
      isProfileComplete: profileComplete,
    },
    recentHistory: recentHistory.slice(-5),
    session: { ...session, isOnboarding: !profileComplete },
  };
}
