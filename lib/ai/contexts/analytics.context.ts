import { supabase } from "@/lib/supabase";
import type { AnalyticsContextData } from "../types";

export async function buildAnalyticsContext(professionalId: string): Promise<AnalyticsContextData> {
  const [profileRes, itemsRes, appointmentsRes] = await Promise.all([
    supabase.from("profiles").select("followers_count, posts_count, avg_rating, total_reviews").eq("id", professionalId).single(),
    supabase
      .from("marketplace_items" as any)
      .select("name, views_count, whatsapp_clicks")
      .eq("seller_id", professionalId)
      .eq("is_active", true)
      .order("views_count", { ascending: false }),
    supabase
      .from("appointments" as any)
      .select("status")
      .in("status", ["confirmed", "completed", "cancelled"]),
  ]);

  const profile = profileRes.data as any;
  const items = (itemsRes.data || []) as any[];
  const appointments = (appointmentsRes.data || []) as any[];

  const totalViews = items.reduce((acc, i) => acc + (i.views_count || 0), 0);
  const totalClicks = items.reduce((acc, i) => acc + (i.whatsapp_clicks || 0), 0);

  return {
    professionalId,
    itemMetrics: {
      total_views: totalViews,
      total_whatsapp_clicks: totalClicks,
      items_count: items.length,
      topItems: items.slice(0, 5).map(i => ({
        name: i.name,
        views: i.views_count || 0,
        clicks: i.whatsapp_clicks || 0,
      })),
    },
    profileStats: {
      followers_count: profile?.followers_count || 0,
      posts_count: profile?.posts_count || 0,
      avg_rating: Number(profile?.avg_rating) || 0,
      total_reviews: profile?.total_reviews || 0,
    },
    appointmentStats: {
      total_confirmed: appointments.filter(a => a.status === "confirmed").length,
      total_completed: appointments.filter(a => a.status === "completed").length,
      total_cancelled: appointments.filter(a => a.status === "cancelled").length,
    },
  };
}
