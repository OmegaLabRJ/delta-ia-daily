import { supabase } from "@/lib/supabase";
import type { CRMContextData } from "../types";

export async function buildCRMContext(professionalId: string): Promise<CRMContextData> {
  const [profileRes, clientsRes] = await Promise.all([
    supabase.from("profiles").select("display_name, business_name").eq("id", professionalId).single(),
    supabase
      .from("client_profiles" as any)
      .select("id, client_name, visit_count, last_visit_date, last_service_name, preferences")
      .eq("professional_id", professionalId)
      .order("last_visit_date", { ascending: true })
      .limit(50),
  ]);

  const profile = profileRes.data as any;
  const now = new Date();

  const clients = ((clientsRes.data || []) as any[]).map(c => {
    const lastVisit = c.last_visit_date ? new Date(c.last_visit_date) : null;
    const daysSince = lastVisit
      ? Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    return {
      id: c.id,
      name: c.client_name || "Cliente",
      visit_count: c.visit_count || 0,
      last_visit_date: c.last_visit_date,
      last_service_name: c.last_service_name,
      preferences: c.preferences,
      days_since_last_visit: daysSince,
    };
  });

  return {
    professionalId,
    professionalName: profile?.business_name || profile?.display_name || "Profissional",
    clients,
    segments: {
      active: clients.filter(c => c.days_since_last_visit <= 30).length,
      at_risk: clients.filter(c => c.days_since_last_visit > 30 && c.days_since_last_visit <= 60).length,
      inactive: clients.filter(c => c.days_since_last_visit > 60).length,
      new_clients: clients.filter(c => c.visit_count <= 1).length,
    },
  };
}
