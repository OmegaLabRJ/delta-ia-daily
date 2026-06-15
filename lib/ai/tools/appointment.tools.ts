import { supabase } from "@/lib/supabase";

export async function executeCreateAppointment(professionalId: string, args: any) {
  const { data: myServices } = await supabase
    .from("marketplace_items" as any)
    .select("id, name, item_type")
    .eq("seller_id", professionalId)
    .eq("is_active", true)
    .eq("item_type", "service");

  if (!myServices || myServices.length === 0) {
    return { success: false, error: "Você precisa cadastrar pelo menos um serviço na sua loja antes de agendar." };
  }

  const serviceName = args.service_name || args.service || "";
  const clientName = args.client_name || args.client || "Cliente Local";
  const dateStr = args.date || new Date().toISOString().split("T")[0];
  const timeStr = args.time || "12:00";

  const matchedService = myServices.find(s => s.name.toLowerCase().includes(serviceName.toLowerCase())) || myServices[0];

  // Validação de conflito
  const serviceIds = myServices.map(s => s.id);
  const { data: overlapping } = await supabase
    .from("appointments" as any)
    .select("id")
    .in("service_id", serviceIds)
    .eq("appointment_date", dateStr)
    .eq("appointment_time", timeStr)
    .in("status", ["confirmed", "pending"]);

  if (overlapping && overlapping.length > 0) {
    return { success: false, error: "⚠️ Já existe um agendamento para este horário. Peça outro horário." };
  }

  // NOVO: find-or-create do cliente em client_profiles
  const { data: existingClient } = await supabase
    .from("client_profiles" as any)
    .select("id")
    .eq("professional_id", professionalId)
    .ilike("name", clientName)
    .maybeSingle();

  let clientProfileId: string | null = null;
  if (existingClient) {
    clientProfileId = (existingClient as any).id;
  } else {
    const { data: newClient, error: clientErr } = await supabase
      .from("client_profiles" as any)
      .insert({ professional_id: professionalId, name: clientName })
      .select("id")
      .single();
    if (!clientErr && newClient) {
      clientProfileId = (newClient as any).id;
    }
  }

  const { data, error } = await supabase
    .from("appointments" as any)
    .insert({
      client_id: professionalId,
      client_profile_id: clientProfileId,
      service_id: matchedService.id,
      appointment_date: dateStr,
      appointment_time: timeStr,
      notes: `[cliente:${clientName}] Agendado via IA. Serviço: ${matchedService.name}`,
      status: "confirmed",
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: `Erro ao agendar: ${error.message}` };
  }

  return {
    success: true,
    action_type: "APPOINTMENT_CREATED",
    message: "Agendamento criado com sucesso.",
    appointment: {
      id: data.id,
      client_name: clientName,
      service: matchedService.name,
      date: dateStr,
      time: timeStr,
    },
  };
}

export async function executeCancelAppointment(professionalId: string, args: any) {
  const { data, error } = await supabase
    .from("appointments" as any)
    .update({ status: "cancelled", notes: args.reason ? `Cancelado: ${args.reason}` : "Cancelado via IA" })
    .eq("id", args.appointment_id)
    .select()
    .single();

  if (error) {
    return { success: false, error: `Erro ao cancelar: ${error.message}` };
  }

  return {
    success: true,
    action_type: "APPOINTMENT_CANCELLED",
    message: "Agendamento cancelado.",
    appointment_id: args.appointment_id,
  };
}

export async function executeListTodayAppointments(professionalId: string, args: any) {
  const date = args.date || new Date().toISOString().split("T")[0];

  const { data: services } = await supabase
    .from("marketplace_items" as any)
    .select("id, name")
    .eq("seller_id", professionalId)
    .eq("item_type", "service");

  if (!services || services.length === 0) {
    return { success: true, action_type: "APPOINTMENTS_LISTED", appointments: [], message: "Nenhum serviço cadastrado." };
  }

  const serviceIds = services.map(s => s.id);
  const serviceMap = new Map(services.map(s => [s.id, s.name]));

  const { data: appointments } = await supabase
    .from("appointments" as any)
    .select("id, service_id, appointment_date, appointment_time, status, notes")
    .in("service_id", serviceIds)
    .eq("appointment_date", date)
    .in("status", ["confirmed", "pending"])
    .order("appointment_time", { ascending: true });

  const parseClientName = (notes: string | null): string => {
    if (!notes) return "Cliente";
    const match = notes.match(/\[cliente:([^\]]+)\]/);
    return match ? match[1] : "Cliente";
  };

  return {
    success: true,
    action_type: "APPOINTMENTS_LISTED",
    date,
    appointments: (appointments || []).map((a: any) => ({
      id: a.id,
      client_name: parseClientName(a.notes),
      service: serviceMap.get(a.service_id) || "Serviço",
      time: a.appointment_time,
      status: a.status,
    })),
  };
}
