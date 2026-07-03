import { supabase } from "@/lib/supabase";

export async function executeCreatePostDraft(professionalId: string, args: any) {
  const { generateImage, enhanceWithArtDirectorRules } = await import("@/lib/image-generation");

  // Enriquece o prompt do Marketing com regras anatômicas + cultura BR (determinístico, 0 tokens)
  const enhancedPrompt = enhanceWithArtDirectorRules(args.image_prompt, args.category);
  const imageRes = await generateImage(enhancedPrompt, args.category);

  if (!imageRes) {
    return {
      success: false,
      error: "A geração de imagem está demorando mais que o normal. Tente novamente em instantes! 🎨",
      draft: { caption: args.caption, category: args.category, image_url: null },
    };
  }

  return {
    success: true,
    action_type: "POST_DRAFT_READY",
    message: "Rascunho de post gerado.",
    draft: { caption: args.caption, category: args.category, image_url: imageRes.url },
  };
}

export async function executeGenerateCalendar(professionalId: string, args: any) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, specialty, location")
    .eq("id", professionalId)
    .single();

  const { data: items } = await supabase
    .from("marketplace_items" as any)
    .select("name, price, item_type")
    .eq("seller_id", professionalId)
    .eq("is_active", true);

  const { data: topPosts } = await supabase
    .from("posts")
    .select("description, likes_count, category")
    .eq("user_id", professionalId)
    .order("likes_count", { ascending: false })
    .limit(5);

  const { callGeminiSimple, resetRateLimit } = await import("@/lib/ai");
  resetRateLimit();

  const postsPerWeek = Math.min(7, Math.max(2, args.posts_per_week || 3));

  const prompt = `Você é um especialista em marketing de beleza no Brasil.
PROFISSIONAL: ${(profile as any)?.display_name || "Profissional"}
ESPECIALIDADE: ${(profile as any)?.specialty || "Beleza em geral"}
SERVIÇOS: ${(items || []).map((i: any) => `${i.name} (R$${i.price})`).join(", ") || "Nenhum cadastrado"}
POSTS QUE MAIS ENGAJARAM: ${(topPosts || []).map((p: any) => p.description?.slice(0, 50)).join(" | ") || "Sem posts"}

Gere um calendário de ${postsPerWeek} posts por semana por 30 dias a partir de ${args.start_date}.
Responda SOMENTE em JSON: {"posts":[{"date":"YYYY-MM-DD","post_type":"before_after|promotion|tip|seasonal|testimonial","caption":"legenda","hashtags":["tag"],"image_prompt":"prompt inglês","service_highlight":"serviço","ai_reasoning":"1 frase"}]}`;

  const geminiResponse = await callGeminiSimple(prompt);

  let calendar: any;
  try {
    let rawText = geminiResponse.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON não encontrado");
    calendar = JSON.parse(jsonMatch[0]);
  } catch {
    return { success: false, error: "A IA não retornou um calendário válido. Tente novamente." };
  }

  if (!calendar.posts || !Array.isArray(calendar.posts) || calendar.posts.length === 0) {
    return { success: false, error: "Calendário vazio gerado." };
  }

  const rows = calendar.posts.map((post: any) => ({
    professional_id: professionalId,
    scheduled_date: post.date,
    status: "draft",
    post_type: post.post_type,
    caption: post.caption,
    hashtags: post.hashtags || [],
    image_prompt: post.image_prompt,
    service_highlight: post.service_highlight,
    ai_reasoning: post.ai_reasoning,
  }));

  await supabase
    .from("content_calendar" as any)
    .delete()
    .eq("professional_id", professionalId)
    .eq("status", "draft")
    .gte("scheduled_date", args.start_date);

  await supabase.from("content_calendar" as any).insert(rows);

  return {
    success: true,
    action_type: "CALENDAR_GENERATED",
    message: `Calendário de ${rows.length} posts gerado!`,
    posts_count: rows.length,
    preview: rows.slice(0, 3).map((r: any) => ({
      date: r.scheduled_date,
      type: r.post_type,
      caption_preview: r.caption?.slice(0, 60) + "...",
    })),
  };
}
