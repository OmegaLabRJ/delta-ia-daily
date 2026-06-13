import { supabase } from "@/lib/supabase";

export async function executeGetRevenueSummary(professionalId: string, args: any) {
  const days = args.period_days || 30;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const dtSince = sinceDate.toISOString().split("T")[0];

  const { data: services } = await supabase
    .from("marketplace_items" as any)
    .select("id, name, price")
    .eq("seller_id", professionalId)
    .eq("item_type", "service");

  const serviceMap = new Map((services || []).map((s: any) => [s.id, { name: s.name, price: Number(s.price) }]));
  const serviceIds = Array.from(serviceMap.keys());

  let appointments: any[] = [];
  if (serviceIds.length > 0) {
    const { data } = await supabase
      .from("appointments" as any)
      .select("service_id, appointment_date")
      .in("service_id", serviceIds)
      .eq("status", "completed")
      .gte("appointment_date", dtSince);
    appointments = data || [];
  }

  const totalRevenue = appointments.reduce((acc, a) => {
    const svc = serviceMap.get(a.service_id);
    return acc + (svc?.price || 0);
  }, 0);

  const avgTicket = appointments.length > 0 ? Math.round(totalRevenue / appointments.length) : 0;
  const projectedMonthly = Math.round((totalRevenue / Math.max(days, 1)) * 30);

  return {
    success: true,
    action_type: "REVENUE_SUMMARY",
    period_days: days,
    metrics: {
      total_revenue: totalRevenue,
      avg_ticket: avgTicket,
      total_appointments: appointments.length,
      projected_monthly: projectedMonthly,
    },
    disclaimer: "Receita estimada com base em agendamentos completados × preço do serviço.",
  };
}

export async function executeSetRevenueGoal(professionalId: string, args: any) {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Upsert: se já existe meta do mês, atualiza
  const { data: existing } = await supabase
    .from("revenue_goals" as any)
    .select("id")
    .eq("professional_id", professionalId)
    .eq("month_year", monthYear)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("revenue_goals" as any)
      .update({ monthly_target: args.monthly_target })
      .eq("id", (existing as any).id);
  } else {
    await supabase.from("revenue_goals" as any).insert({
      professional_id: professionalId,
      monthly_target: args.monthly_target,
      month_year: monthYear,
    });
  }

  return {
    success: true,
    action_type: "REVENUE_GOAL_SET",
    message: `Meta de R$ ${args.monthly_target} definida para ${monthYear}!`,
    monthly_target: args.monthly_target,
  };
}
