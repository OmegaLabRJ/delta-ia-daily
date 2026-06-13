/**
 * Hook: useAIChat — Gerencia chat com a Consultora Daily e dicas do popup mascote
 *
 * Usa Gemini API diretamente do client-side para o popup (rápido),
 * e tRPC pro chat completo (com histórico persistido no servidor).
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { AIChatMessage } from "@/lib/supabase-types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { callGeminiProxy, resetRateLimit } from "@/lib/ai";
import { AI_TOOLS, executeAITool } from "@/lib/ai-tools";
import { classifyLocal } from "@/lib/intent-classifier";
import { Router } from "@/lib/ai/router";


// ─── Types ───────────────────────────────────────────────────────────────────

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  actionData?: any;
};

// ─── Supabase-based Context Builder (client-side) ────────────────────────────

async function buildContextForGemini(userId: string): Promise<string> {
  try {
    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) return "";

    // Fetch shop items
    const { data: items } = await supabase
      .from("marketplace_items" as any)
      .select("name, price, item_type, views_count, whatsapp_clicks, duration_minutes")
      .eq("seller_id", userId)
      .eq("is_active", true);

    const p = profile as any;
    const shopItems = (items || []) as any[];

    // Fetch upcoming appointments
    const dateStr = new Date().toISOString().split("T")[0];
    const { data: appts } = await supabase
      .from("appointments" as any)
      .select("appointment_date, appointment_time, client_id")
      .eq("status", "confirmed")
      .gte("appointment_date", dateStr)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true })
      .limit(10);
      
    const upcomingAppts = appts || [];

    const now = new Date();

    // ✅ Eventos com verificação de data real (não mais por mês inteiro)
    const EVENTS_CALENDAR: { name: string; emoji: string; month: number; day: number }[] = [
      { name: "Dia da Mulher", emoji: "💐", month: 3, day: 8 },
      { name: "Páscoa", emoji: "🐣", month: 4, day: 20 },
      { name: "Dia das Mães", emoji: "👩‍👧", month: 5, day: 11 },
      { name: "Dia dos Namorados", emoji: "💕", month: 6, day: 12 },
      { name: "Festa Junina", emoji: "🌽", month: 6, day: 24 },
      { name: "Dia dos Pais", emoji: "👨‍👧", month: 8, day: 10 },
      { name: "Dia do Cliente", emoji: "🤝", month: 9, day: 15 },
      { name: "Dia das Crianças", emoji: "🧒", month: 10, day: 12 },
      { name: "Black Friday", emoji: "🏷️", month: 11, day: 28 },
      { name: "Natal", emoji: "🎄", month: 12, day: 25 },
    ];

    const events: string[] = [];
    for (const evt of EVENTS_CALENDAR) {
      const evtDate = new Date(now.getFullYear(), evt.month - 1, evt.day);
      const diffDays = Math.ceil((evtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 15) {
        events.push(`${evt.emoji} ${evt.name} em ${diffDays} dia(s)!`);
      }
    }

    const baseCtx = `
PROFISSIONAL: ${p.display_name || p.username}
NOME COMERCIAL: ${p.business_name || "Não definido"}
TIPO: ${p.profile_type === "professional" ? "Profissional" : p.profile_type === "store" ? "Loja" : "Usuário"}
ESPECIALIDADE: ${p.specialty || "Não definida"}
BIO: ${p.bio || "Sem bio"}
LOCALIZAÇÃO: ${p.location || "Não informada"}
HORÁRIO DE ATENDIMENTO: ${p.business_hours || "Não definido"}
WHATSAPP: ${p.whatsapp ? "Configurado" : "NÃO CONFIGURADO — URGENTE, sugira ao profissional configurar!"}
INSTAGRAM/SITE: ${p.website || "Não configurado"}
SEGUIDORES: ${p.followers_count || 0}
POSTS: ${p.posts_count || 0}
AVALIAÇÃO: ${p.avg_rating ? `${Number(p.avg_rating).toFixed(1)}/5 (${p.total_reviews || 0} avaliações)` : "Ainda sem avaliações"}

💅 SERVIÇOS QUE REALIZA:
${p.offered_services || "⚠️ NÃO INFORMADO — Pergunte ao profissional quais serviços ele(a) realiza e use save_memory para salvar!"}

🛍️ ANÚNCIOS NA LOJA (${shopItems.length} itens):
${shopItems.length > 0 ? shopItems.map((i: any) => `- ${i.name} (R$${Number(i.price).toFixed(2)}) | tipo: ${i.item_type === "service" ? "serviço" : "produto"} | ${i.views_count || 0} views | ${i.whatsapp_clicks || 0} cliques zap${i.item_type === "service" && i.duration_minutes ? ` | duração: ${i.duration_minutes}min` : ""}`).join("\n") : "Nenhum anúncio cadastrado — sugira criar o primeiro!"}

📅 AGENDA (próximos ${upcomingAppts.length} agendamentos confirmados):
${upcomingAppts.length > 0 ? upcomingAppts.map((a: any) => `- ${a.appointment_date} às ${a.appointment_time}`).join("\n") : "Agenda livre nos próximos dias."}

PRÓXIMA LACUNA A PREENCHER (pergunte apenas esta, ao final da resposta):
${(() => {
  // Prioridade: 1) Serviços, 2) Horários, 3) WhatsApp, 4) Bio, 5) Localização, 6) Loja vazia
  if (!p.offered_services) return "Quais serviços realiza (ex: manicure, pedicure, alongamento)";
  if (!p.business_hours) return "Horário de atendimento (ex: Seg-Sáb 9h-19h)";
  if (!p.whatsapp) return "Número de WhatsApp para contato";
  if (!p.bio) return "Uma bio profissional descrevendo seu trabalho";
  if (!p.location) return "Localização / região de atendimento";
  if (shopItems.length === 0) return "Nenhum anúncio na loja — ajude a criar o primeiro";
  return "Nenhum dado essencial faltando! ✅";
})()}

${events.length > 0 ? `\nEVENTOS PRÓXIMOS: ${events.join(" | ")}` : ""}`.trim();

    // Camada 2: Memória persistente do negócio
    let memoriesSection = '';
    try {
      const { data: memories } = await supabase
        .from('professional_memory' as any)
        .select('memory_type, content')
        .eq('professional_id', userId)
        .gte('confidence', 0.5)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (memories && memories.length > 0) {
        memoriesSection = `\n\nMEMÓRIA DO NEGÓCIO (aprendi em conversas anteriores):\n${(memories as any[]).map(m => `[${m.memory_type}] ${m.content}`).join('\n')}`;
      }
    } catch {}

    return baseCtx + memoriesSection;
  } catch {
    return "";
  }
}

const SYSTEM_PROMPT = `Você é a Consultora Daily — o BRAÇO DIREITO do vendedor. Pense como uma CEO dos negócios e do marketing, mas FALE como uma amiga de confiança.

QUEM VOCÊ É:
- Você é a parceira de negócios que todo vendedor queria ter
- Você entende de vendas, preços, como atrair clientes, como postar melhor, como crescer
- Você conhece o mercado brasileiro: o que vende em cada época, o que o cliente quer
- Você é amiga de verdade — fala a real quando precisa, elogia quando merece

COMO VOCÊ FALA:
- Fale como uma AMIGA aconselhando outra no dia a dia. Nada de palavras difíceis
- ZERO termos técnicos ou jargões. Nada de "funil de vendas", "ROI", "engajamento orgânico", "KPI"
- Se precisar explicar algo mais complexo, use exemplos do dia a dia
- Em vez de "aumente seu engajamento" diga "faça as pessoas comentarem mais"
- Em vez de "otimize seu funil" diga "facilite pro cliente chegar até você"
- Em vez de "posicionamento de marca" diga "como as pessoas veem seu trabalho"

COMO VOCÊ ATUA:
- Analise o negócio do profissional com PROFUNDIDADE. Dê diagnósticos completos.
- Você tem liberdade para falar quantas linhas quiser, mas SEJA OBJETIVA ou DIVIDA O TEXTO EM PARTES para ajudar o usuário.
- Use linguagem simples, porém profissional. Pense que o usuário, na maior parte, são pessoas mais simples, com escolaridade de nível médio a fundamental. Evite palavras difíceis ou jargões técnicos.
- Após executar ações no sistema (como criar post ou agendar), peça revisão humana: "Verifique se ficou tudo certo, às vezes posso errar um detalhe 😊"
- NUNCA crie um post ou promoção no feed sem antes perguntar e CONFIRMAR o valor/preço com o usuário. Sugira um valor baseado no histórico e espere a confirmação!
- NUNCA execute a mesma função duas vezes seguidas na mesma resposta. Execute no máximo UMA ação por resposta.
- Crie planos práticos: o que postar, quando postar, como precificar, o que falar pro cliente.
- Use emojis com moderação pra deixar a leitura gostosa.
- Sua identidade: Consultora Daily. Nunca diga "sou uma IA" ou "sou um robô".
- Termine com pergunta ou sugestão do próximo passo.
- Quando fizer análise, organize bem: use listas, tópicos, passo a passo.

COLETA PROATIVA DE INFORMAÇÕES (OBRIGATÓRIO):
- No contexto há uma seção "DADOS FALTANTES". Se houver itens faltando, PERGUNTE sobre eles naturalmente durante a conversa.
- Escolha EXATAMENTE 1 dado faltante por mensagem e pergunte no final. NÃO pergunte tudo de uma vez.
- Quando o profissional responder, USE save_memory para guardar PERMANENTEMENTE.
- PRIORIDADE de coleta: 1) Serviços que realiza, 2) Preços praticados, 3) Horários de atendimento, 4) Público-alvo
- Exemplo de coleta natural: "A propósito, pra eu te ajudar melhor... quais serviços você faz? Tipo manicure, pedicure, alongamento...?"
- NUNCA pergunte dados que já estão no contexto. Leia o contexto com atenção antes de perguntar.

CONHECIMENTO DE PREÇOS:
- Os preços dos anúncios estão no contexto. Use-os como base para sugestões.
- Se sugerir promoção, baseie no preço REAL do anúncio (ex: "seu serviço custa R$80, que tal um combo de 3 por R$200?")
- Se não souber o preço, PERGUNTE antes de sugerir valores.

MEMÓRIA DO NEGÓCIO:
- Quando o profissional revelar algo importante (horários que não trabalha, clientes preferidos, preços praticados, tipo de post que funciona, serviços realizados, público-alvo, diferenciais), USE A TOOL 'save_memory' para guardar.
- Nas próximas conversas, esse contexto estará disponível e use naturalmente, sem perguntar de novo.
- Exemplos: "Não trabalho domingo", "Minha melhor cliente é a Maria", "Cobro R$150 por coloração", "Faço manicure, pedicure e alongamento", "Atendo mais mulheres de 25-45 anos".

CALENDÁRIO DE POSTS:
- Se o profissional pedir ajuda com conteúdo para vários dias, use a tool 'generate_content_calendar'.
- Explique que ele pode revisar e aprovar os posts na tela de Calendário.`;


// ─── Hook: useAIChat ─────────────────────────────────────────────────────────

export function useAIChat(userId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shopTip, setShopTip] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const contextRef = useRef<string>("");
  const contextTimestampRef = useRef<number>(0);
  const loadedRef = useRef(false);
  const lastNativeIntentRef = useRef<{ intent: string, text: string } | null>(null);
  const routerRef = useRef<Router>(new Router());

  // Load chat history from AsyncStorage on mount
  useEffect(() => {
    if (!userId || loadedRef.current) return;
    loadedRef.current = true;

    AsyncStorage.getItem(`ai_chat_${userId}`).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as ChatMessage[];
          setMessages(parsed.slice(-50)); // Keep last 50 messages
        } catch {}
      }
    });

    // Pre-build context
    buildContextForGemini(userId).then((ctx) => {
      contextRef.current = ctx;
      contextTimestampRef.current = Date.now();
    });
  }, [userId]);

  // Save messages to AsyncStorage whenever they change
  useEffect(() => {
    if (!userId || messages.length === 0) return;
    AsyncStorage.setItem(`ai_chat_${userId}`, JSON.stringify(messages.slice(-50))).catch(() => {});
  }, [messages, userId]);

  // Also save to Supabase (fire-and-forget)
  const saveToDB = useCallback(
    async (userMsg: string, aiMsg: string) => {
      if (!userId) return;
      try {
        await supabase.from("ai_chat_history" as any).insert([
          { user_id: userId, role: "user", content: userMsg },
          { user_id: userId, role: "assistant", content: aiMsg },
        ]);
      } catch {}
    },
    [userId],
  );

  /**
   * Fetch a contextual shop tip for the mascot popup
   */
  const fetchShopTip = useCallback(async () => {
    if (!userId) return;
    setTipLoading(true);

    try {
      const ctx = await buildContextForGemini(userId);
      contextRef.current = ctx;

      const now = new Date();

      let tipPrompt = "Você acabou de ver a loja do profissional. Seja PROATIVA e AGRESSIVA nas vendas. Gere UMA sugestão rápida de AÇÃO que ele deve tomar agora para atrair clientes. Dê ideias de promoções, como melhorar a visibilidade, ou engajamento. Máximo 3 frases. Linguagem amiga e animada.";

      // ✅ Seasonal boost com data real
      const SEASON_EVENTS = [
        { name: "Dia das Mães", month: 5, day: 11 },
        { name: "Dia dos Namorados", month: 6, day: 12 },
        { name: "Festa Junina", month: 6, day: 24 },
        { name: "Black Friday", month: 11, day: 28 },
        { name: "Natal", month: 12, day: 25 },
      ];
      for (const evt of SEASON_EVENTS) {
        const evtDate = new Date(now.getFullYear(), evt.month - 1, evt.day);
        const diff = Math.ceil((evtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff <= 15) {
          tipPrompt += ` O ${evt.name} está chegando em ${diff} dia(s)!`;
          break;
        }
      }

      const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n[CONTEXTO DO PROFISSIONAL]\n${contextRef.current}`;

      const data = await callGeminiProxy({
        system_instruction: { parts: [{ text: fullSystemPrompt }] },
        contents: [{ role: "user", parts: [{ text: tipPrompt }] }],
        generationConfig: { temperature: 0.78, maxOutputTokens: 1024 }
      });
      const tip = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      setShopTip(tip);
    } catch (e) {
      console.error("[AI] Error fetching tip:", e);
      setShopTip("💡 Que tal criar um post mostrando seu trabalho? Profissionais que postam regularmente atraem 3x mais clientes! ✨");
    } finally {
      setTipLoading(false);
    }
  }, [userId]);

  /**
   * Send a message to the AI consultant
   */
  const sendMessage = useCallback(
    async (text: string) => {
      if (!userId || !text.trim()) return;
      setIsLoading(true);

      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);

      try {
        // --- 1. CLASSIFICADOR LOCAL: FAQs estáticas (0 tokens) ---
        const { intent, confidence } = classifyLocal(text);
        console.log(`[Intent] ${intent} (${confidence})`);

        // Feedback loop para intent incorreta
        if (lastNativeIntentRef.current && intent === "open_question") {
           supabase.from('intent_feedback').insert({
              user_id: userId,
              text: lastNativeIntentRef.current.text,
              predicted_intent: lastNativeIntentRef.current.intent,
              confidence: confidence,
              correct: false,
           }).then(null, () => {});
        }
        lastNativeIntentRef.current = null;

        // FAQs estáticas — resolvidas com 0 tokens
        if (confidence >= 0.8) {
          let nativeResponse = "";
          if (intent === "schedule_faq") nativeResponse = "🗓️ Para gerenciar seus agendamentos, toque na aba 'Agenda' no menu principal!";
          else if (intent === "faq_location") nativeResponse = "📍 Seu endereço já está salvo no seu Perfil! Você pode alterá-lo na tela de Configurações.";
          else if (intent === "faq_hours") nativeResponse = "⏰ O seu horário de funcionamento pode ser ajustado na seção 'Meus Horários' do seu Perfil.";

          if (nativeResponse) {
             const aiMsg: ChatMessage = {
                id: `ai_${Date.now()}`,
                role: "assistant",
                content: nativeResponse,
                timestamp: Date.now(),
             };
             setMessages((prev) => [...prev, aiMsg]);
             saveToDB(text.trim(), nativeResponse);
             lastNativeIntentRef.current = { intent, text };
             return;
          }
        }

        // --- 2. ROUTER DE SUBAGENTES ---
        const aiMsgId = `ai_${Date.now()}`;
        setMessages((prev) => [...prev, { id: aiMsgId, role: "assistant", content: "...", timestamp: Date.now() }]);

        const result = await routerRef.current.route(text.trim(), userId, (chunk) => {
          setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: chunk } : m));
        });

        console.log(`[Router] Agent: ${result.agentUsed}`);

        // Atualizar mensagem com resposta final + actionData
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId
            ? { ...m, content: result.text, actionData: result.actionData }
            : m
        ));

        // Save to DB (fire-and-forget)
        saveToDB(text.trim(), result.text);
      } catch (e: any) {
        console.error("[AI Chat Error]", e?.message || e);

        const errorMessages: Record<string, string> = {
          RATE_LIMIT: "Muitas mensagens em pouco tempo 🕐 Aguarde uns segundos e tente de novo!",
          TIMEOUT: "A resposta demorou muito... A IA está lenta agora. Tenta de novo em alguns segundos! ⏳",
          AUTH_EXPIRED: "Sua sessão expirou 🔒 Feche e abra o app novamente.",
          SERVER_ERROR: "A IA está sobrecarregada no momento 🔄 Tenta de novo em alguns segundos!",
          NETWORK_ERROR: "Parece que sua conexão está instável 📶 Verifique sua internet e tente novamente.",
        };

        const msgKey = String(e?.message);
        let errorContent = "Desculpa, tive um probleminha 😅 Tenta de novo!";
        if (errorMessages[msgKey]) errorContent = errorMessages[msgKey];

        const errorMsg: ChatMessage = {
          id: `ai_err_${Date.now()}`,
          role: "assistant",
          content: errorContent,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [userId, saveToDB],
  );

  /**
   * Clear chat history
   */
  const clearChat = useCallback(async () => {
    if (!userId) return;
    setMessages([]);
    routerRef.current.reset(); // Limpa SessionContext + histórico do Router
    await AsyncStorage.removeItem(`ai_chat_${userId}`).catch(() => {});
  }, [userId]);

  const addLocalMessage = useCallback((text: string, actionData?: any) => {
    const aiMsg: ChatMessage = {
      id: `ai_${Date.now()}`,
      role: "assistant",
      content: text,
      timestamp: Date.now(),
      actionData,
    };
    setMessages((prev) => [...prev, aiMsg]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    addLocalMessage,
    shopTip,
    tipLoading,
    fetchShopTip,
    clearChat,
  };
}
