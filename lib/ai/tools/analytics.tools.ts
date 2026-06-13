import { supabase } from "@/lib/supabase";

export async function executeGetAnalytics(professionalId: string, args: any) {
  const days = args.period_days || 30;

  const { data: items } = await supabase
    .from("marketplace_items" as any)
    .select("id, views_count, whatsapp_clicks")
    .eq("seller_id", professionalId);

  const totalViews = items?.reduce((acc, item: any) => acc + (item.views_count || 0), 0) || 0;
  const totalClicks = items?.reduce((acc, item: any) => acc + (item.whatsapp_clicks || 0), 0) || 0;

  const serviceIds = (items || []).map((i: any) => i.id);
  let totalAppointments = 0;

  if (serviceIds.length > 0) {
    const { data: appointments } = await supabase
      .from("appointments" as any)
      .select("id")
      .in("service_id", serviceIds)
      .in("status", ["confirmed", "completed"]);
    totalAppointments = appointments?.length || 0;
  }

  return {
    success: true,
    action_type: "ANALYTICS_FETCHED",
    period_days: days,
    metrics: {
      total_profile_views: totalViews,
      whatsapp_clicks: totalClicks,
      total_appointments: totalAppointments,
    },
    data_note: `Dados acumulados desde o início, não apenas dos últimos ${days} dias.`,
  };
}
