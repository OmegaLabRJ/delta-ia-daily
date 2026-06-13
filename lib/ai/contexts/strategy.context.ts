import { supabase } from "@/lib/supabase";
import type { StrategyContextData } from "../types";
import { getUpcomingEvents } from "./shared-utils";

export async function buildStrategyContext(professionalId: string): Promise<StrategyContextData> {
  const [profileRes, servicesRes, memoriesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, business_name, specialty, bio, location, business_hours, whatsapp, followers_count, posts_count, avg_rating")
      .eq("id", professionalId)
      .single(),
    supabase
      .from("marketplace_items" as any)
      .select("name, price, item_type")
      .eq("seller_id", professionalId)
      .eq("is_active", true),
    supabase
      .from("professional_memory" as any)
      .select("memory_type, content")
      .eq("professional_id", professionalId)
      .gte("confidence", 0.5)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const p = profileRes.data as any;

  return {
    professionalId,
    profile: {
      display_name: p?.display_name || "",
      business_name: p?.business_name || "",
      specialty: p?.specialty || "",
      bio: p?.bio || "",
      location: p?.location || "",
      business_hours: p?.business_hours || "",
      whatsapp: p?.whatsapp || "",
      followers_count: p?.followers_count || 0,
      posts_count: p?.posts_count || 0,
      avg_rating: Number(p?.avg_rating) || 0,
    },
    services: ((servicesRes.data || []) as any[]).map(s => ({
      name: s.name,
      price: Number(s.price),
      item_type: s.item_type,
    })),
    memories: ((memoriesRes.data || []) as any[]).map(m => ({
      type: m.memory_type,
      content: m.content,
    })),
    upcomingEvents: getUpcomingEvents(),
  };
}
