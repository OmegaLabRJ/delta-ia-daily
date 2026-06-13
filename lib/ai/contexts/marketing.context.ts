import { supabase } from "@/lib/supabase";
import type { MarketingContextData } from "../types";
import { getUpcomingEvents } from "./shared-utils";

export async function buildMarketingContext(professionalId: string): Promise<MarketingContextData> {
  const [profileRes, topPostsRes, servicesRes, memoriesRes] = await Promise.all([
    supabase.from("profiles").select("display_name, business_name, specialty, location").eq("id", professionalId).single(),
    supabase
      .from("posts")
      .select("description, likes_count, category")
      .eq("user_id", professionalId)
      .order("likes_count", { ascending: false })
      .limit(5),
    supabase
      .from("marketplace_items" as any)
      .select("name, price")
      .eq("seller_id", professionalId)
      .eq("is_active", true),
    supabase
      .from("professional_memory" as any)
      .select("memory_type, content")
      .eq("professional_id", professionalId)
      .in("memory_type", ["preference", "pattern"])
      .gte("confidence", 0.5)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  const profile = profileRes.data as any;

  return {
    professionalId,
    professionalName: profile?.business_name || profile?.display_name || "Profissional",
    specialty: profile?.specialty || "Beleza em geral",
    location: profile?.location || "Brasil",
    topPosts: ((topPostsRes.data || []) as any[]).map(p => ({
      description: p.description?.slice(0, 100) || "",
      likes_count: p.likes_count || 0,
      category: p.category || "",
    })),
    services: ((servicesRes.data || []) as any[]).map(s => ({
      name: s.name,
      price: Number(s.price),
    })),
    memories: ((memoriesRes.data || []) as any[]).map(m => ({
      type: m.memory_type,
      content: m.content,
    })),
    upcomingEvents: getUpcomingEvents(),
  };
}
