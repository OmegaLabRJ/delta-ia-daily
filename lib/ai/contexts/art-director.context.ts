import { supabase } from "@/lib/supabase";

export interface ArtDirectorContextData {
  professionalId: string;
  professionalName: string;
  specialty: string;
  location: string;
  services: { name: string; price: number }[];
}

export async function buildArtDirectorContext(
  professionalId: string,
): Promise<ArtDirectorContextData> {
  const [profileRes, servicesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, business_name, specialty, location")
      .eq("id", professionalId)
      .single(),
    supabase
      .from("marketplace_items" as any)
      .select("name, price")
      .eq("seller_id", professionalId)
      .eq("is_active", true)
      .limit(10),
  ]);

  const profile = profileRes.data as any;

  return {
    professionalId,
    professionalName: profile?.business_name || profile?.display_name || "Profissional",
    specialty: profile?.specialty || "Beleza em geral",
    location: profile?.location || "Brasil",
    services: ((servicesRes.data || []) as any[]).map((s) => ({
      name: s.name,
      price: s.price,
    })),
  };
}
