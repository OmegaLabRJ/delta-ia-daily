import { supabase } from "@/lib/supabase";
import type { OnboardingContextData } from "../types";

export async function buildOnboardingContext(professionalId: string): Promise<OnboardingContextData> {
  const [profileRes, itemsRes, memoriesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, business_name, specialty, bio, location, business_hours, whatsapp, offered_services")
      .eq("id", professionalId)
      .single(),
    supabase
      .from("marketplace_items" as any)
      .select("id")
      .eq("seller_id", professionalId)
      .eq("is_active", true)
      .limit(1),
    supabase
      .from("professional_memory" as any)
      .select("content")
      .eq("professional_id", professionalId)
      .limit(20),
  ]);

  const p = profileRes.data as any;
  const hasItems = ((itemsRes.data || []) as any[]).length > 0;

  const profileFlags = {
    has_specialty: !!p?.specialty,
    has_bio: !!p?.bio,
    has_location: !!p?.location,
    has_business_hours: !!p?.business_hours,
    has_whatsapp: !!p?.whatsapp,
    has_offered_services: !!p?.offered_services,
    has_shop_items: hasItems,
  };

  // Dados faltantes ordenados por prioridade
  const missingData: OnboardingContextData["missingData"] = [];
  if (!profileFlags.has_offered_services)
    missingData.push({ field: "offered_services", priority: 1, suggestedQuestion: "Quais serviços você faz? Tipo manicure, pedicure, alongamento..." });
  if (!profileFlags.has_business_hours)
    missingData.push({ field: "business_hours", priority: 2, suggestedQuestion: "Qual seu horário de atendimento? Ex: Seg-Sáb 9h-19h" });
  if (!profileFlags.has_whatsapp)
    missingData.push({ field: "whatsapp", priority: 3, suggestedQuestion: "Qual seu WhatsApp pra contato com clientes?" });
  if (!profileFlags.has_bio)
    missingData.push({ field: "bio", priority: 4, suggestedQuestion: "Me conta um pouco sobre seu trabalho pra eu criar sua bio" });
  if (!profileFlags.has_location)
    missingData.push({ field: "location", priority: 5, suggestedQuestion: "Em qual região você atende?" });
  if (!profileFlags.has_shop_items)
    missingData.push({ field: "shop_items", priority: 6, suggestedQuestion: "Bora criar seu primeiro serviço na loja?" });

  return {
    professionalId,
    professionalName: p?.business_name || p?.display_name || "Profissional",
    profile: profileFlags,
    missingData,
    existingMemories: ((memoriesRes.data || []) as any[]).map(m => m.content),
  };
}

export function isProfileIncomplete(profile: OnboardingContextData["profile"]): boolean {
  return !profile.has_specialty
    || !profile.has_business_hours
    || !profile.has_whatsapp
    || !profile.has_offered_services;
}
