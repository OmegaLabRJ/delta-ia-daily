import { supabase } from "./supabase";

/**
 * Declarações de ferramentas para o Gemini (Function Calling)
 */
export const AI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "create_appointment",
        description: "Agendar um horário para um cliente na agenda do profissional.",
        parameters: {
          type: "object",
          properties: {
            client_name: { type: "string", description: "Nome do cliente. Ex: Maria" },
            service_name: { type: "string", description: "Nome do serviço EXATAMENTE como aparece na lista de serviços da loja. Se o cliente usou um termo informal, mapeie para o nome oficial. Ex: cliente disse 'gel francesa' → use 'Unhas de Gel'" },
            date: { type: "string", description: "Data no formato YYYY-MM-DD. Ex: 2026-05-10" },
            time: { type: "string", description: "Horário no formato HH:MM. Ex: 15:00" },
          },
          required: ["client_name", "service_name", "date", "time"],
        },
      },
      {
        name: "create_post_draft",
        description: "Criar um rascunho de post (imagem e legenda) para o feed do profissional.",
        parameters: {
          type: "object",
          properties: {
            caption: { type: "string", description: "Legenda engajadora para o post, com emojis." },
            category: { type: "string", description: "Categoria do post. Ex: Unhas, Cabelo, Maquiagem, Dicas" },
            image_prompt: { type: "string", description: "Descrição visual detalhada em inglês para a IA de imagens. Inclua: sujeito principal, elementos visuais específicos, ambiente e estilo. Ex: 'close-up of gel nail art with rose gold glitter on marble table, soft natural window light, photorealistic'" },
          },
          required: ["caption", "category", "image_prompt"],
        },
      },
      {
        name: "get_analytics",
        description: "Obter um resumo de métricas do negócio (visualizações, cliques no WhatsApp, faturamento estimado).",
        parameters: {
          type: "object",
          properties: {
            period_days: { type: "number", description: "Período em dias para analisar (ex: 7, 30)." },
          },
          required: ["period_days"],
        },
      },
      {
        name: "suggest_price",
        description: "Sugerir um preço justo de mercado para um serviço, com justificativa.",
        parameters: {
          type: "object",
          properties: {
            service_name: { type: "string", description: "Nome do serviço para precificar. Ex: Platinado masculino" },
            region_type: { type: "string", description: "Tipo de região. Ex: bairro nobre, centro popular, interior." },
          },
          required: ["service_name", "region_type"],
        },
      },
      {
        name: "save_memory",
        description: "Salvar uma informação importante sobre o negócio do profissional para lembrar no futuro. Use quando o profissional revelar uma preferência, padrão de cliente, limitação operacional, ou insight relevante. NÃO use para: saudações, confirmações de leitura ('ok', 'entendi'), perguntas passageiras, ou informações que o profissional já tem no perfil. USE para: fatos permanentes sobre o negócio que mudam como você o atende.",
        parameters: {
          type: "object",
          properties: {
            memory_type: { type: "string", description: "Tipo: 'preference' (preferência do profissional), 'pattern' (padrão observado), 'client' (info de cliente recorrente), 'insight' (aprendizado do negócio)" },
            content: { type: "string", description: "A informação a salvar em linguagem natural. Ex: 'Profissional não trabalha aos sábados de tarde', 'Posts de antes/depois geram 3x mais cliques no WhatsApp'" },
          },
          required: ["memory_type", "content"],
        },
      },
      {
        name: "generate_content_calendar",
        description: "Gerar um calendário COMPLETO de 30 dias com múltiplos posts. Use SOMENTE quando o profissional pedir planejamento de conteúdo para vários dias/semanas. NÃO use para criar um post isolado — use create_post_draft para isso.",
        parameters: {
          type: "object",
          properties: {
            start_date: { type: "string", description: "Data de início no formato YYYY-MM-DD" },
            posts_per_week: { type: "number", description: "Quantidade de posts por semana desejada (mínimo 2, máximo 7)" },
          },
          required: ["start_date", "posts_per_week"],
        },
      },
    ],
  },
];

/**
 * Função para registrar o Feedback do usuário sobre uma ação da IA (KPI)
 */
export async function trackAIFeedback(professionalId: string, actionType: string, feedback: 'edited' | 'cancelled' | 'accepted') {
  try {
    await supabase.from("ai_action_feedbacks").insert({
      user_id: professionalId,
      action_type: actionType,
      feedback: feedback
    });
  } catch (e) {
    console.log("Erro ao registrar feedback da IA:", e);
  }
}

/**
 * Executor central de funções da IA do Profissional
 */
export async function executeAITool(name: string, args: any, professionalId: string): Promise<any> {
  const startTime = Date.now();
  let result: any;

  try {
    // 💰 PREPARAÇÃO PARA MONETIZAÇÃO (Descomente e ajuste quando tiver o plano Premium)
    /*
    const currentMonth = new Date();
    const firstDayOfMonth = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01T00:00:00Z`;

    const { count } = await supabase
      .from('ai_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', professionalId)
      .gte('created_at', firstDayOfMonth); // ✅ Fix: filtra pelo mês atual, não total histórico
      
    // TODO: Adicionar campo is_premium na tabela profiles + integrar RevenueCat/Mercado Pago
    // const { data: prof } = await supabase.from('profiles').select('is_premium').eq('id', professionalId).single();
    // const isPremium = prof?.is_premium ?? false;
    const isPremium = false; 
    const usageCount = count || 0;

    if (!isPremium && usageCount >= 10) {
      return { success: false, error: "Você atingiu o limite de 10 ações da IA este mês no plano Gratuito. Faça o upgrade para continuar automatizando seu negócio." };
    }
    */

    switch (name) {
      case "create_appointment":
        result = await executeCreateAppointment(professionalId, args);
        break;
      case "create_post_draft":
        result = await executeCreatePostDraft(professionalId, args);
        break;
      case "get_analytics":
        result = await executeGetAnalytics(professionalId, args);
        break;
      case "suggest_price":
        result = await executeSuggestPrice(args);
        break;
      case "save_memory":
        result = await executeSaveMemory(professionalId, args);
        break;
      case "generate_content_calendar":
        result = await executeGenerateCalendar(professionalId, args);
        break;
      default:
        result = { error: `Função ${name} não encontrada ou não implementada.` };
    }

    // 📊 OBSERVABILITY (Loga o uso no banco)
    const latency = Date.now() - startTime;
    try {
      await supabase.from("ai_usage_logs").insert({
        user_id: professionalId,
        action_type: name,
        latency_ms: latency,
        status: result?.success ? 'success' : 'error'
      });
    } catch (logErr: unknown) {
      console.log("Erro ao salvar log da IA (a tabela já foi criada no Supabase?)", logErr);
    }

    return result;

  } catch (err: any) {
    const latency = Date.now() - startTime;
    try {
      await supabase.from("ai_usage_logs").insert({
        user_id: professionalId,
        action_type: name,
        latency_ms: latency,
        status: 'fatal_error'
      });
    } catch (_logErr: unknown) {
      // Silently ignore — we're already in an error handler
    }

    return { error: err.message || "Erro interno ao executar a ferramenta." };
  }
}

async function executeCreateAppointment(professionalId: string, args: any) {
  try {
    // ⚠️ LIMITAÇÃO V1: client_id usa o ID do profissional como placeholder.
    // A tabela appointments requer um UUID válido referenciando profiles.
    // O nome real do cliente é salvo em `notes` com formato parseável.
    // TODO v2: Criar tabela `external_clients` (name, phone, professional_id)
    //          e usar o external_client_id aqui em vez do professionalId.
    
    const { data: myServices } = await supabase
      .from("marketplace_items" as any)
      .select("id, name")
      .eq("seller_id", professionalId)
      .eq("is_active", true);

    if (!myServices || myServices.length === 0) {
      return { success: false, error: "Você precisa cadastrar pelo menos um serviço na sua loja antes de agendar." };
    }

    // Achar o serviço mais parecido
    const matchedService = myServices.find(s => s.name.toLowerCase().includes(args.service_name.toLowerCase())) || myServices[0];
    const serviceId = matchedService.id;
    const serviceNameFinal = matchedService.name;

    // 🔒 VALIDAÇÃO DE CONFLITO NO BACKEND (Human-in-the-Loop Constraint)
    const serviceIds = myServices.map(s => s.id);
    const { data: overlapping } = await supabase
      .from("appointments" as any)
      .select("id")
      .in("service_id", serviceIds)
      .eq("appointment_date", args.date)
      .eq("appointment_time", args.time)
      .in("status", ["confirmed", "pending"]);

    if (overlapping && overlapping.length > 0) {
      return { success: false, error: "⚠️ ALERTA DE CONFLITO DE AGENDA: Já existe um agendamento para este horário exato. Ação bloqueada pelo sistema. Avise o usuário e peça outro horário." };
    }

    const { data, error } = await supabase
      .from("appointments" as any)
      .insert({
        client_id: professionalId, // ⚠️ Placeholder v1 — ver TODO acima
        service_id: serviceId,
        appointment_date: args.date,
        appointment_time: args.time,
        notes: `[cliente:${args.client_name}] Agendado via IA. Serviço: ${args.service_name}`,
        status: "confirmed"
      })
      .select()
      .single();

    if (error) throw error;
    
    return {
      success: true,
      action_type: "APPOINTMENT_CREATED",
      message: "Agendamento criado com sucesso.",
      appointment: {
        id: data.id,
        client_name: args.client_name,
        service: serviceNameFinal,
        date: args.date,
        time: args.time
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao criar agendamento no banco." };
  }
}

async function executeCreatePostDraft(professionalId: string, args: any) {
  const { generateImage } = await import('@/lib/image-generation');
  const imageRes = await generateImage(args.image_prompt, args.category);

  return {
    success: true,
    action_type: "POST_DRAFT_READY",
    message: "Rascunho de post gerado. Envie os dados para o usuário revisar.",
    draft: {
      caption: args.caption,
      category: args.category,
      image_url: imageRes.url,
    }
  };
}

async function executeGetAnalytics(professionalId: string, args: any) {
  try {
    const days = args.period_days || 30;
    
    // Consulta itens do profissional
    const { data: items } = await supabase
      .from("marketplace_items" as any)
      .select("id, views_count, whatsapp_clicks")
      .eq("seller_id", professionalId);

    const totalViews = items?.reduce((acc, item) => acc + (item.views_count || 0), 0) || 0;
    const totalClicks = items?.reduce((acc, item) => acc + (item.whatsapp_clicks || 0), 0) || 0;

    // Consulta agenda FILTRADA pelo profissional (via service_ids)
    const serviceIds = (items || []).map((i: any) => i.id);
    let totalAppointments = 0;

    if (serviceIds.length > 0) {
      const { data: appointments } = await supabase
        .from("appointments" as any)
        .select("id")
        .in("service_id", serviceIds)
        .in("status", ["confirmed", "completed"]);
      
      totalAppointments = appointments?.length || 0;
    }

    return {
      success: true,
      action_type: "ANALYTICS_FETCHED",
      period_days: days,
      metrics: {
        total_profile_views: totalViews,
        whatsapp_clicks: totalClicks,
        total_appointments: totalAppointments,
        estimated_revenue_status: "Depende dos valores dos serviços fechados"
      },
      // Honestidade: views/clicks/agendamentos são acumulados, não filtrados por período
      data_note: `Atenção: as visualizações, cliques no WhatsApp e número de agendamentos mostrados são totais acumulados desde o início, não apenas dos últimos ${days} dias.`
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function executeSuggestPrice(args: any) {
  // ⚠️ V1: Regras estáticas baseadas em médias do mercado brasileiro de beleza.
  // NÃO é pesquisa de mercado real — são estimativas fixas por categoria + região.
  // TODO v2: Integrar com dados reais de preços dos profissionais no Daily
  //          (média de marketplace_items por categoria + localização geográfica).
  const service = args.service_name.toLowerCase();
  const region = args.region_type.toLowerCase();
  
  let basePrice = 50;

  // ── Unhas ──
  if (service.includes("manicure")) basePrice = 45;
  if (service.includes("pedicure")) basePrice = 55;
  if (service.includes("nail art")) basePrice = 90;
  if (service.includes("unha") && service.includes("gel")) basePrice = 120;

  // ── Cabelo ──
  if (service.includes("corte")) basePrice = 60;
  if (service.includes("escova")) basePrice = 60;
  if (service.includes("hidratação") || service.includes("hidratacao")) basePrice = 80;
  if (service.includes("penteado")) basePrice = 120;
  if (service.includes("progressiva") || service.includes("botox capilar")) basePrice = 180;
  if (service.includes("luzes")) basePrice = 200;
  if (service.includes("platinado")) basePrice = 200;
  if (service.includes("coloração") || service.includes("mechas")) basePrice = 250;

  // ── Rosto / Sobrancelha ──
  if (service.includes("design") && service.includes("sobrancelha")) basePrice = 50;
  if (service.includes("maquiagem")) basePrice = 150;
  if (service.includes("sobrancelha") && service.includes("micro")) basePrice = 450;

  // ── Corpo ──
  if (service.includes("depilação") || service.includes("depilacao")) basePrice = 80;
  if (service.includes("massagem")) basePrice = 120;
  if (service.includes("spa") && (service.includes("pé") || service.includes("pe"))) basePrice = 70;

  // ── Cílios ──
  if (service.includes("lash") || service.includes("cílios") || service.includes("cilios")) basePrice = 180;
  if (service.includes("alongamento") && (service.includes("cílios") || service.includes("cilios"))) basePrice = 250;

  // ── Barbearia ──
  if (service.includes("barba")) basePrice = 40;

  // ── Tranças ──
  if (service.includes("trança") || service.includes("tranca")) basePrice = 100;

  let multiplier = 1;
  if (region.includes("nobre") || region.includes("shopping")) multiplier = 1.6;
  if (region.includes("popular") || region.includes("interior")) multiplier = 0.8;
  if (region.includes("centro")) multiplier = 1.1;

  const suggestedPrice = Math.round(basePrice * multiplier);
  const minPrice = Math.round(suggestedPrice * 0.85);
  const maxPrice = Math.round(suggestedPrice * 1.25);

  return {
    success: true,
    action_type: "PRICE_SUGGESTION",
    service: args.service_name,
    suggested_price: suggestedPrice,
    range: `R$ ${minPrice} até R$ ${maxPrice}`,
    // ✅ Disclaimer honesto: baseado em estimativas, não dados reais
    justification: `Estimativa baseada em médias do mercado de beleza para '${args.service_name}' em região '${args.region_type}'. Faixa sugerida: R$${minPrice}–R$${maxPrice}. Esses valores são referências iniciais — ajuste conforme sua experiência, custos e concorrência local.`,
    disclaimer: "Valores estimados com base em referências de mercado. Não constitui pesquisa de preços em tempo real."
  };
}

// ─── CAMADA 2: Memória Persistente ──────────────────────────────────────────

async function executeSaveMemory(professionalId: string, args: any) {
  try {
    // Verifica duplicata por tipo + conteúdo similar (primeiros 40 chars)
    const searchKey = args.content.slice(0, 40).replace(/[%_]/g, '');
    const { data: existing } = await supabase
      .from('professional_memory' as any)
      .select('id, content')
      .eq('professional_id', professionalId)
      .eq('memory_type', args.memory_type)
      .limit(50);

    const duplicate = (existing || []).find((m: any) =>
      m.content.toLowerCase().includes(searchKey.toLowerCase()) ||
      searchKey.toLowerCase().includes(m.content.slice(0, 40).toLowerCase())
    );

    // Fase 3: Cálculo do TTL (Cache expiration)
    let expiresAt: string | null = null;
    if (args.ttl_days) {
      const date = new Date();
      date.setDate(date.getDate() + args.ttl_days);
      expiresAt = date.toISOString();
    }

    if (duplicate) {
      await supabase
        .from('professional_memory' as any)
        .update({ 
          content: args.content, 
          confidence: 1.0, 
          updated_at: new Date().toISOString(),
          expires_at: expiresAt
        })
        .eq('id', (duplicate as any).id);
    } else {
      await supabase
        .from('professional_memory' as any)
        .insert({
          professional_id: professionalId,
          memory_type: args.memory_type,
          content: args.content,
          expires_at: expiresAt
        });
    }

    return { success: true, action_type: "MEMORY_SAVED", message: "Informação guardada na memória do negócio." };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── CAMADA 4: Calendário de Conteúdo ───────────────────────────────────────

async function executeGenerateCalendar(professionalId: string, args: any) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, specialty, location')
      .eq('id', professionalId)
      .single();

    const { data: items } = await supabase
      .from('marketplace_items' as any)
      .select('name, price, item_type')
      .eq('seller_id', professionalId)
      .eq('is_active', true);

    const { data: topPosts } = await supabase
      .from('posts')
      .select('description, likes_count, category')
      .eq('user_id', professionalId)
      .order('likes_count', { ascending: false })
      .limit(5);

    const { callGeminiSimple, resetRateLimit } = await import('@/lib/ai');
    // Reset rate limit — esta é uma chamada derivada de dentro de uma tool execution,
    // a chamada principal do Consultora já contou no rate limiter.
    resetRateLimit();

    const postsPerWeek = Math.min(7, Math.max(2, args.posts_per_week || 3));

    // Eventos sazonais próximos (30 dias) para contextualizar o calendário
    const now = new Date();
    const EVENTS_CALENDAR = [
      { name: "Dia da Mulher", month: 3, day: 8 },
      { name: "Páscoa", month: 4, day: 20 },
      { name: "Dia das Mães", month: 5, day: 11 },
      { name: "Dia dos Namorados", month: 6, day: 12 },
      { name: "Festa Junina", month: 6, day: 24 },
      { name: "Dia dos Pais", month: 8, day: 10 },
      { name: "Dia do Cliente", month: 9, day: 15 },
      { name: "Dia das Crianças", month: 10, day: 12 },
      { name: "Black Friday", month: 11, day: 28 },
      { name: "Natal", month: 12, day: 25 },
    ];
    const upcomingEvents = EVENTS_CALENDAR
      .filter(evt => {
        const evtDate = new Date(now.getFullYear(), evt.month - 1, evt.day);
        const diff = Math.ceil((evtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 30;
      })
      .map(evt => evt.name);

    const prompt = `Você é um especialista em marketing de beleza no Brasil.

PROFISSIONAL: ${(profile as any)?.display_name || 'Profissional'}
ESPECIALIDADE: ${(profile as any)?.specialty || 'Beleza em geral'}
LOCALIZAÇÃO: ${(profile as any)?.location || 'Brasil'}
SERVIÇOS: ${(items || []).map((i: any) => `${i.name} (R$${i.price})`).join(', ') || 'Nenhum cadastrado'}
POSTS QUE MAIS ENGAJARAM: ${(topPosts || []).map((p: any) => p.description?.slice(0, 50)).join(' | ') || 'Sem posts anteriores'}
${upcomingEvents.length > 0 ? `\nEVENTOS SAZONAIS PRÓXIMOS (priorize estes): ${upcomingEvents.join(', ')}` : ''}

Gere um calendário de ${postsPerWeek} posts por semana por 30 dias a partir de ${args.start_date}.

Responda SOMENTE em JSON válido, sem texto fora do JSON:
{"posts":[{"date":"YYYY-MM-DD","post_type":"before_after|promotion|tip|seasonal|testimonial","caption":"legenda com emojis","hashtags":["tag1"],"image_prompt":"prompt em inglês","service_highlight":"serviço","ai_reasoning":"1 frase"}]}

Varie os tipos. Inclua CTAs para agendamento.`;

    const geminiResponse = await callGeminiSimple(prompt);

    // Robust JSON parsing — strip markdown code fences first
    let calendar: any;
    try {
      let rawText = geminiResponse;
      // Strip ```json ... ``` wrappers from Gemini response
      rawText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON não encontrado na resposta');
      calendar = JSON.parse(jsonMatch[0]);
    } catch {
      return { success: false, error: 'A IA não retornou um calendário válido. Tente novamente.' };
    }

    if (!calendar.posts || !Array.isArray(calendar.posts) || calendar.posts.length === 0) {
      return { success: false, error: 'Calendário vazio gerado. Tente novamente.' };
    }

    const rows = calendar.posts.map((post: any) => ({
      professional_id: professionalId,
      scheduled_date: post.date,
      status: 'draft',
      post_type: post.post_type,
      caption: post.caption,
      hashtags: post.hashtags || [],
      image_prompt: post.image_prompt,
      service_highlight: post.service_highlight,
      ai_reasoning: post.ai_reasoning,
    }));

    // Remove drafts anteriores do mesmo período
    await supabase
      .from('content_calendar' as any)
      .delete()
      .eq('professional_id', professionalId)
      .eq('status', 'draft')
      .gte('scheduled_date', args.start_date);

    await supabase.from('content_calendar' as any).insert(rows);

    return {
      success: true,
      action_type: "CALENDAR_GENERATED",
      message: `Calendário de ${rows.length} posts gerado para os próximos 30 dias! Acesse a tela de Calendário para revisar e aprovar.`,
      posts_count: rows.length,
      preview: rows.slice(0, 3).map((r: any) => ({
        date: r.scheduled_date,
        type: r.post_type,
        caption_preview: r.caption?.slice(0, 60) + '...',
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao gerar calendário.' };
  }
}
