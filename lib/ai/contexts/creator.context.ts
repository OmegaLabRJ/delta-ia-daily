import { supabase } from "@/lib/supabase";

export async function buildCreatorContext(creatorId: string) {

  // Memória persistente do criador
  const { data: memoriesData } = await supabase
    .from("creator_memory")
    .select("memory_type, content")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(20);
  const memories = memoriesData as any[];

  // Posts recentes
  const { data: recentPostsData } = await supabase
    .from("posts")
    .select("category, likes_count, comments_count, created_at")
    .eq("user_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(10);
  const recentPosts = recentPostsData as any[];

  // Total de seguidores
  const { count: followerCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", creatorId);

  // Monta contexto em texto para o prompt
  const memoryText = (memories || [])
    .map(m => `[${m.memory_type}] ${m.content}`)
    .join("\n") || "Nenhuma memória ainda.";

  const postsText = (recentPosts || [])
    .map(p => 
      `- ${p.category || "sem categoria"}: ` +
      `${p.likes_count} likes, ${p.comments_count} comentários`
    )
    .join("\n") || "Nenhum post ainda.";

  return `
CONTEXTO DO CRIADOR:
Seguidores: ${followerCount || 0}

Posts recentes:
${postsText}

O que você já sabe sobre esse criador:
${memoryText}
  `.trim();
}
