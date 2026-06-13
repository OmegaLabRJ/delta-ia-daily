import { supabase } from "@/lib/supabase";
import type { PricingContextData } from "../types";

export async function buildPricingContext(professionalId: string): Promise<PricingContextData> {
  const [profileRes, itemsRes] = await Promise.all([
    supabase.from("profiles").select("location, specialty").eq("id", professionalId).single(),
    supabase
      .from("marketplace_items" as any)
      .select("name, price, item_type")
      .eq("seller_id", professionalId)
      .eq("is_active", true),
  ]);

  const profile = profileRes.data as any;

  return {
    professionalId,
    location: profile?.location || "Não informada",
    specialty: profile?.specialty || "Beleza em geral",
    currentPrices: ((itemsRes.data || []) as any[]).map(i => ({
      name: i.name,
      price: Number(i.price),
      item_type: i.item_type,
    })),
  };
}
