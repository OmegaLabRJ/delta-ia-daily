import { supabase } from "@/lib/supabase";

export async function executeListInactiveClients(professionalId: string, args: any) {
  const threshold = args.days_threshold || 30;
  const { data: clients } = await supabase
    .from("client_profiles" as any)
    .select("id, client_name, visit_count, last_visit_date, last_service_name, preferences")
    .eq("professional_id", professionalId);

  const now = new Date();
  const inactive = ((clients || []) as any[])
    .map(c => {
      const lastVisit = c.last_visit_date ? new Date(c.last_visit_date) : null;
      const daysSince = lastVisit ? Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      return { ...c, days_since: daysSince };
    })
    .filter(c => c.days_since >= threshold)
    .sort((a, b) => b.days_since - a.days_since);

  return {
    success: true,
    action_type: "INACTIVE_CLIENTS_LISTED",
    threshold_days: threshold,
    clients: inactive.map(c => ({
      id: c.id,
      name: c.client_name,
      days_since: c.days_since,
      last_service: c.last_service_name,
      visits: c.visit_count,
    })),
    total: inactive.length,
  };
}

export async function executeSaveClientNote(professionalId: string, args: any) {
  const { data: existing } = await supabase
    .from("client_profiles" as any)
    .select("id, notes")
    .eq("id", args.client_id)
    .eq("professional_id", professionalId)
    .maybeSingle();

  if (!existing) {
    return { success: false, error: "Cliente não encontrado." };
  }

  const currentNotes = (existing as any).notes || "";
  const updated = currentNotes ? `${currentNotes}\n${args.note}` : args.note;

  await supabase
    .from("client_profiles" as any)
    .update({ notes: updated, updated_at: new Date().toISOString() })
    .eq("id", args.client_id);

  return { success: true, action_type: "CLIENT_NOTE_SAVED", message: "Nota salva." };
}
