import { supabase } from "@/lib/supabase";
import type { FinanceContextData } from "../types";

export async function buildFinanceContext(professionalId: string): Promise<FinanceContextData> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dtThirty = thirtyDaysAgo.toISOString().split("T")[0];

  const currentMonth = new Date();
  const monthYear = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;

  const [servicesRes, appointmentsRes, goalRes] = await Promise.all([
    supabase
      .from("marketplace_items" as any)
      .select("id, name, price")
      .eq("seller_id", professionalId)
      .eq("is_active", true)
      .eq("item_type", "service"),
    supabase
      .from("appointments" as any)
      .select("service_id, appointment_date, status")
      .eq("status", "completed")
      .gte("appointment_date", dtThirty),
    supabase
      .from("revenue_goals" as any)
      .select("monthly_target")
      .eq("professional_id", professionalId)
      .eq("month_year", monthYear)
      .maybeSingle(),
  ]);

  const services = (servicesRes.data || []) as any[];
  const completedAppts = (appointmentsRes.data || []) as any[];
  const serviceMap = new Map(services.map(s => [s.id, { name: s.name, price: Number(s.price) }]));

  const enrichedAppointments = completedAppts
    .map(a => {
      const svc = serviceMap.get(a.service_id);
      return svc ? { service_name: svc.name, service_price: svc.price, date: a.appointment_date } : null;
    })
    .filter(Boolean) as FinanceContextData["completedAppointments"];

  const totalRevenue = enrichedAppointments.reduce((acc, a) => acc + a.service_price, 0);
  const avgTicket = enrichedAppointments.length > 0 ? totalRevenue / enrichedAppointments.length : 0;
  // Projeção linear: (receita dos últimos 30 dias / dias passados) * 30
  const daysPassed = Math.max(1, Math.ceil((Date.now() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24)));
  const projectedMonthly = Math.round((totalRevenue / daysPassed) * 30);

  let revenueGoal: FinanceContextData["revenueGoal"];
  if (goalRes.data) {
    const target = Number((goalRes.data as any).monthly_target);
    revenueGoal = {
      monthly_target: target,
      current_progress: totalRevenue,
      percentage: target > 0 ? Math.round((totalRevenue / target) * 100) : 0,
    };
  }

  return {
    professionalId,
    services: services.map(s => ({ name: s.name, price: Number(s.price) })),
    completedAppointments: enrichedAppointments,
    metrics: {
      total_revenue_30d: totalRevenue,
      avg_ticket: Math.round(avgTicket),
      appointments_30d: enrichedAppointments.length,
      projected_monthly: projectedMonthly,
    },
    revenueGoal,
  };
}
