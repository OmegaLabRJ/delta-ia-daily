/**
 * Hook: useSchedule — Gerencia agenda do profissional e booking de clientes
 */
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Schedule } from "@/lib/supabase-types";

export type DaySchedule = {
  dayOfWeek: number;
  enabled: boolean;
  startTime: string; // "09:00"
  endTime: string;   // "18:00"
};

export type ScheduleConfig = {
  days: DaySchedule[];
  slotDurationMin: number;
  breakBetweenMin: number;
  autoApprove: boolean;
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const DEFAULT_CONFIG: ScheduleConfig = {
  days: [
    { dayOfWeek: 0, enabled: false, startTime: "09:00", endTime: "18:00" },
    { dayOfWeek: 1, enabled: true, startTime: "09:00", endTime: "18:00" },
    { dayOfWeek: 2, enabled: true, startTime: "09:00", endTime: "18:00" },
    { dayOfWeek: 3, enabled: true, startTime: "09:00", endTime: "18:00" },
    { dayOfWeek: 4, enabled: true, startTime: "09:00", endTime: "18:00" },
    { dayOfWeek: 5, enabled: true, startTime: "09:00", endTime: "18:00" },
    { dayOfWeek: 6, enabled: false, startTime: "09:00", endTime: "13:00" },
  ],
  slotDurationMin: 60,
  breakBetweenMin: 15,
  autoApprove: true,
};

/**
 * Gera slots de horário disponíveis para uma data específica
 */
export function generateTimeSlots(
  startTime: string,
  endTime: string,
  slotDurationMin: number,
  breakBetweenMin: number,
): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes + slotDurationMin <= endMinutes) {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    currentMinutes += slotDurationMin + breakBetweenMin;
  }

  return slots;
}

export function useSchedule(userId: string | undefined) {
  const [config, setConfig] = useState<ScheduleConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load schedule from Supabase
  const loadSchedule = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const { data } = await supabase
        .from("schedules" as any)
        .select("*")
        .eq("professional_id", userId)
        .order("day_of_week", { ascending: true });

      if (data && data.length > 0) {
        const schedules = data as any[];
        const days = DEFAULT_CONFIG.days.map((defaultDay) => {
          const saved = schedules.find((s: any) => s.day_of_week === defaultDay.dayOfWeek);
          if (saved) {
            return {
              dayOfWeek: saved.day_of_week,
              enabled: saved.is_active,
              startTime: saved.start_time?.slice(0, 5) || defaultDay.startTime,
              endTime: saved.end_time?.slice(0, 5) || defaultDay.endTime,
            };
          }
          return defaultDay;
        });

        const firstSaved = schedules[0] as any;
        setConfig({
          days,
          slotDurationMin: firstSaved?.slot_duration_min || 60,
          breakBetweenMin: firstSaved?.break_between_min || 15,
          autoApprove: firstSaved?.auto_approve ?? true,
        });
      }
    } catch (e) {
      console.error("[Schedule] Load error:", e);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    if (userId && !loaded) loadSchedule();
  }, [userId, loaded, loadSchedule]);

  // Save schedule to Supabase
  const saveSchedule = useCallback(
    async (newConfig: ScheduleConfig) => {
      if (!userId) return;
      setSaving(true);

      try {
        // Delete existing schedules for this user
        await supabase
          .from("schedules" as any)
          .delete()
          .eq("professional_id", userId);

        // Insert enabled days
        const enabledDays = newConfig.days.filter((d) => d.enabled);
        if (enabledDays.length > 0) {
          const rows = enabledDays.map((day) => ({
            professional_id: userId,
            day_of_week: day.dayOfWeek,
            start_time: day.startTime,
            end_time: day.endTime,
            slot_duration_min: newConfig.slotDurationMin,
            break_between_min: newConfig.breakBetweenMin,
            is_active: true,
            auto_approve: newConfig.autoApprove,
          }));

          await supabase.from("schedules" as any).insert(rows);
        }

        setConfig(newConfig);
      } catch (e) {
        console.error("[Schedule] Save error:", e);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [userId],
  );

  // Get available slots for a specific date (for client-side booking)
  const getAvailableSlots = useCallback(
    async (
      professionalId: string,
      serviceId: string,
      date: Date,
    ): Promise<{ available: string[]; booked: string[] }> => {
      const dayOfWeek = date.getDay();

      // 1. Fetch schedule for this day
      const { data: scheduleData } = await supabase
        .from("schedules" as any)
        .select("*")
        .eq("professional_id", professionalId)
        .eq("day_of_week", dayOfWeek)
        .eq("is_active", true)
        .maybeSingle();

      if (!scheduleData) {
        return { available: [], booked: [] };
      }

      const schedule = scheduleData as any;

      // 2. Generate all possible slots
      const allSlots = generateTimeSlots(
        schedule.start_time?.slice(0, 5) || "09:00",
        schedule.end_time?.slice(0, 5) || "18:00",
        schedule.slot_duration_min || 60,
        schedule.break_between_min || 15,
      );

      // 3. Fetch booked slots for this date
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const { data: appointments } = await supabase
        .from("appointments" as any)
        .select("appointment_time")
        .eq("service_id", serviceId)
        .eq("appointment_date", dateStr)
        .neq("status", "cancelled");

      const booked = (appointments || []).map((a: any) => a.appointment_time?.slice(0, 5) || "");

      const available = allSlots.filter((slot) => !booked.includes(slot));

      return { available, booked };
    },
    [],
  );

  // Book a slot
  const bookSlot = useCallback(
    async (
      serviceId: string,
      date: Date,
      time: string,
      clientId: string,
      professionalId: string,
    ): Promise<{ success: boolean; autoApproved: boolean }> => {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      // Check if auto-approve is enabled
      const { data: scheduleData } = await supabase
        .from("schedules" as any)
        .select("auto_approve")
        .eq("professional_id", professionalId)
        .eq("day_of_week", date.getDay())
        .maybeSingle();

      const autoApprove = (scheduleData as any)?.auto_approve ?? true;

      // Validação de conflito: previne double-booking (race condition entre check e insert)
      const { data: existing } = await supabase
        .from("appointments" as any)
        .select("id")
        .eq("service_id", serviceId)
        .eq("appointment_date", dateStr)
        .eq("appointment_time", time)
        .neq("status", "cancelled")
        .limit(1);

      if (existing && existing.length > 0) {
        return { success: false, autoApproved: false };
      }

      // Fetch client profile to extract name for the notes
      const { data: clientProfile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", clientId)
        .maybeSingle();
      
      const clientName = (clientProfile as any)?.display_name || (clientProfile as any)?.username || "Cliente";

      const { data: newAppointment, error } = await supabase.from("appointments" as any).insert({
        client_id: clientId,
        service_id: serviceId,
        appointment_date: dateStr,
        appointment_time: time,
        status: autoApprove ? "confirmed" : "pending",
        notes: `cliente: ${clientName}`
      }).select().single();

      if (error || !newAppointment) {
        console.error("[Schedule] Book error:", error);
        return { success: false, autoApproved: false };
      }

      // NOVO: Linkar o client_profile criado pela trigger
      const { data: profile } = await supabase
        .from("client_profiles")
        .select("id")
        .eq("client_id", clientId)
        .eq("professional_id", professionalId)
        .maybeSingle();

      if (profile) {
        await supabase
          .from("appointments")
          .update({ client_profile_id: profile.id })
          .eq("id", newAppointment.id);
      }

      // Send notification to professional
      try {
        const { data: service } = await supabase
          .from("marketplace_items" as any)
          .select("name, seller_id")
          .eq("id", serviceId)
          .maybeSingle();

        if (service) {
          const clientName = (clientProfile as any)?.display_name || (clientProfile as any)?.username || "Cliente";
          await supabase.from("notifications").insert({
            user_id: (service as any).seller_id,
            type: "appointment",
            title: autoApprove ? "Novo agendamento confirmado! 📅" : "Novo agendamento pendente! ⏳",
            body: `${clientName} agendou "${(service as any).name}" para ${dateStr.split("-").reverse().join("/")} às ${time}`,
            actor_id: clientId,
            target_type: "appointment",
          });

          // Dispara notificação Push via Edge Function
          supabase.functions.invoke("notify-booking", {
            body: {
              professional_id: professionalId,
              consumer_id: clientId,
              consumer_name: clientName,
              service_name: (service as any).name,
              date: dateStr.split("-").reverse().join("/"),
              time: time,
              consumer_phone: (clientProfile as any)?.whatsapp || null,
            }
          }).catch(console.error);
        }
      } catch {}

      return { success: true, autoApproved: autoApprove };
    },
    [],
  );

  return {
    config,
    setConfig,
    loading,
    saving,
    saveSchedule,
    getAvailableSlots,
    bookSlot,
    dayLabels: DAY_LABELS,
  };
}
