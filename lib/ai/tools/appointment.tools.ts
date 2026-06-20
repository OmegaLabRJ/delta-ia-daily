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

  const matchedService = myServices.find((s: any) => s.name.toLowerCase().includes(serviceName.toLowerCase())) || myServices[0];

  // Validação de conflito
  const serviceIds = myServices.map((s: any) => s.id);
  const { data: overlapping } = await supabase
    .from("appointments" as any)
    .select("id")
    .in("service_id", serviceIds)
    .eq("appointment_date", dateStr)
    .eq("appointment_time", timeStr)
    .in("status", ["confirmed", "pending"]);

  if (overlapping && overlapping.length > 0) {
    return { success: false, error: "Oops! Já existe um agendamento para este horário. Peça outro horário." };
  }

  // NOVO: find-or-create do cliente em client_profiles
  const { data: existingClient } = await supabase
    .from("client_profiles" as any)
    .select("id")
    .eq("professional_id", professionalId)
    .ilike("client_name", `%${clientName}%`)
    .maybeSingle();

  let clientProfileId: string | null = null;
  if (existingClient) {
    clientProfileId = (existingClient as any).id;
  } else {
    const { data: newClient, error: clientErr } = await supabase
      .from("client_profiles" as any)
      .insert({ professional_id: professionalId, client_name: clientName })
      .select("id")
      .single();
    if (!clientErr && newClient) {
      clientProfileId = (newClient as any).id;
    }
  }

  const { data, error } = await supabase
    .from("appointments" as any)
    .insert({
      client_id: args.client_id || professionalId,
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

  // Notificar imediatamente o profissional (e cliente, se for do app)
  supabase.functions.invoke("notify-booking", {
    body: {
      professional_id: professionalId,
      consumer_id: args.client_id || null,
      consumer_name: clientName,
      service_name: matchedService.name,
      date: dateStr,
      time: timeStr,
    }
  }).catch(e => console.error("Erro ao enviar notificacao de agendamento:", e));

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

  const serviceIds = services.map((s: any) => s.id);
  const serviceMap = new Map(services.map((s: any) => [s.id, s.name]));

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

export async function executeSearchAppUser(professionalId: string, args: any) {
  const query = args.query;
  if (!query) return { success: false, error: `"query" é obrigatório para a busca.` };

  const { data, error } = await supabase
    .from("profiles" as any)
    .select("id, display_name, username, whatsapp")
    .or(`display_name.ilike.%${query}%,username.ilike.%${query}%,whatsapp.ilike.%${query}%`)
    .limit(3);

  if (error || !data || data.length === 0) {
    return { success: false, error: "Usuário não encontrado no app. Você pode prosseguir com o agendamento como cliente externo." };
  }

  return {
    success: true,
    action_type: "APP_USER_FOUND",
    message: "Encontrado! Use o ID retornado para agendar.",
    users: data,
  };
}
