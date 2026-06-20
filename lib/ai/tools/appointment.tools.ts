import { supabase } from "@/lib/supabase";

function parseDefensiveDate(rawDate: string): string {
  if (!rawDate) return new Date().toISOString().split("T")[0];
  let d = rawDate.toLowerCase().trim();
  const today = new Date();
  
  if (d.includes("hoje") || d === "today") return today.toISOString().split("T")[0];
  if (d.includes("amanhã") || d.includes("amanha") || d === "tomorrow") {
    today.setDate(today.getDate() + 1);
    return today.toISOString().split("T")[0];
  }
  
  if (d.length <= 2 && !isNaN(parseInt(d, 10))) {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  
  if (d.includes("/")) {
    const parts = d.split("/");
    if (parts.length === 3 && parts[0].length <= 2) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    } else if (parts.length === 2) {
      return `${today.getFullYear()}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }

  const isoMatch = d.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];

  return rawDate;
}

function parseDefensiveTime(rawTime: string): string {
  let t = String(rawTime || "12:00").toLowerCase().replace(/horas|hora|hs|h/g, "").trim();
  if (t.length <= 2 && !isNaN(parseInt(t, 10))) {
    return `${t.padStart(2, "0")}:00`;
  }
  if (t.length >= 5) return t.substring(0, 5);
  return t;
}

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
  const dateStr = parseDefensiveDate(args.date);
  const timeStr = parseDefensiveTime(args.time);

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
  const date = parseDefensiveDate(args.date);

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
