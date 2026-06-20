import { supabase } from "@/lib/supabase";
import type { AgendaContextData } from "../types";

export async function buildAgendaContext(professionalId: string): Promise<AgendaContextData> {
  const [profileRes, servicesRes, scheduleRes] = await Promise.all([
    supabase.from("profiles").select("display_name, business_name").eq("id", professionalId).single(),
    supabase
      .from("marketplace_items" as any)
      .select("id, name, duration_minutes, price")
      .eq("seller_id", professionalId)
      .eq("is_active", true)
      .eq("item_type", "service"),
    supabase
      .from("schedules" as any)
      .select("day_of_week, start_time, end_time, slot_duration_min, break_between_min, auto_approve")
      .eq("professional_id", professionalId)
      .eq("is_active", true),
  ]);

  const profile = profileRes.data as any;
  const services = (servicesRes.data || []) as any[];
  const serviceIds = services.map(s => s.id);

  let appointments: any[] = [];
  if (serviceIds.length > 0) {
    const appointmentsRes = await supabase
      .from("appointments" as any)
      .select("id, appointment_date, appointment_time, status, notes, service_id")
      .in("service_id", serviceIds)
      .gte("appointment_date", new Date().toISOString().split("T")[0])
      .in("status", ["confirmed", "pending"])
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true })
      .limit(20);
    appointments = (appointmentsRes.data || []) as any[];
  }

  // Extrair client_name do campo notes (pattern [cliente:X])
  const parseClientName = (notes: string | null): string => {
    if (!notes) return "Cliente";
    const match = notes.match(/\[cliente:([^\]]+)\]/);
    return match ? match[1] : "Cliente";
  };

  // Enriquecer appointments com nome do serviço
  const serviceMap = new Map(services.map(s => [s.id, s.name]));

  return {
    professionalId,
    professionalName: profile?.business_name || profile?.display_name || "Profissional",
    services: services.map(s => ({
      id: s.id,
      name: s.name,
      duration_minutes: s.duration_minutes || 60,
      price: Number(s.price),
    })),
    todayAppointments: appointments.map(a => ({
      id: a.id,
      client_name: parseClientName(a.notes),
      service_name: serviceMap.get(a.service_id) || "Serviço",
      date: a.appointment_date,
      time: a.appointment_time,
      status: a.status,
    })),
    schedule: ((scheduleRes.data || []) as any[]).map(s => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      slot_duration_min: s.slot_duration_min || 60,
      break_between_min: s.break_between_min || 15,
      auto_approve: s.auto_approve ?? true,
    })),
  };
}
