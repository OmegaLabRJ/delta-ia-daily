import { supabase } from "@/lib/supabase";

export async function executeSaveMemory(professionalId: string, args: any) {
  const searchKey = args.content.slice(0, 40).replace(/[%_]/g, "");
  const { data: existing } = await supabase
    .from("professional_memory" as any)
    .select("id, content")
    .eq("professional_id", professionalId)
    .eq("memory_type", args.memory_type)
    .limit(50);

  const duplicate = (existing || []).find(
    (m: any) =>
      m.content.toLowerCase().includes(searchKey.toLowerCase()) ||
      searchKey.toLowerCase().includes(m.content.slice(0, 40).toLowerCase()),
  );

  let expiresAt: string | null = null;
  if (args.ttl_days) {
    const date = new Date();
    date.setDate(date.getDate() + args.ttl_days);
    expiresAt = date.toISOString();
  }

  if (duplicate) {
    await supabase
      .from("professional_memory" as any)
      .update({ content: args.content, confidence: 1.0, updated_at: new Date().toISOString(), expires_at: expiresAt })
      .eq("id", (duplicate as any).id);
  } else {
    await supabase.from("professional_memory" as any).insert({
      professional_id: professionalId,
      memory_type: args.memory_type,
      content: args.content,
      expires_at: expiresAt,
    });
  }

  return { success: true, action_type: "MEMORY_SAVED", message: "Informação guardada na memória do negócio." };
}
