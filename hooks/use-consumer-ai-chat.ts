import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useSchedule } from "@/hooks/use-schedule";
import { callGeminiProxy, GeminiContent } from "@/lib/ai";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

// Limite de entries no historyRef.
// Cada agendamento gera ~4 entries (user, model+functionCall, function, model+text).
// 40 entries = ~10 agendamentos completos antes de começar a truncar.
const MAX_HISTORY_ENTRIES = 40;

// Limite de recursão do processResponse.
// Na prática 1 tool call por turno já resolve 99% dos casos.
// Limite de 5 é proteção contra bug no modelo, não uso normal.
const MAX_RECURSION_DEPTH = 5;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConsumerAIChat(professionalId: string, consumerId?: string) {
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const contextRef  = useRef<string>("");
  const historyRef  = useRef<GeminiContent[]>([]);
  const loadedRef   = useRef(false);

  const { getAvailableSlots, bookSlot } = useSchedule(professionalId);

  // ── Inicialização do contexto ────────────────────────────────────────────────
  useEffect(() => {
    if (!professionalId || loadedRef.current) return;
    loadedRef.current = true;
    buildContext();
  }, [professionalId]);

  async function buildContext() {
    try {
      // Dados do profissional e seus serviços
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, business_name, location, business_hours, specialty, avg_rating, whatsapp")
        .eq("id", professionalId)
        .single();

      const { data: items } = await supabase
        .from("marketplace_items" as any)
        .select("id, name, price, description, item_type, available_days, available_times")
        .eq("seller_id", professionalId)
        .eq("is_active", true);

      const proName = (profile as any)?.business_name || (profile as any)?.display_name || "Profissional";
      const services = (items || []) as any[];
      const servicesList = services.map(i =>
        `  • ID: ${i.id} | ${i.name} | ${i.item_type === "service" ? "Serviço" : "Produto"} | R$${i.price}${i.description ? ` | ${i.description}` : ""}`
      ).join("\n");

      // Contexto de cliente recorrente (Camada 3)
      let clientInfo = "";
      let isRecurring = false;
      let lastService = "";
      let clientFirstName = "";

      if (consumerId) {
        try {
          const [{ data: clientProfile }, { data: consumerProfile }] = await Promise.all([
            supabase
              .from("client_profiles" as any)
              .select("visit_count, last_service_name, last_visit_date, preferences, notes")
              .eq("client_id", consumerId)
              .eq("professional_id", professionalId)
              .maybeSingle(),
            supabase
              .from("profiles")
              .select("display_name")
              .eq("id", consumerId)
              .maybeSingle(),
          ]);

          clientFirstName = (consumerProfile as any)?.display_name?.split(" ")[0] || "";

          if (clientProfile && (clientProfile as any).visit_count > 0) {
            const cp = clientProfile as any;
            isRecurring = true;
            lastService = cp.last_service_name || "";
            clientInfo = `
CLIENTE ATUAL — HISTÓRICO:
• Visitou ${cp.visit_count} vez(es) esta loja
• Último serviço: ${cp.last_service_name || "não registrado"}
• Última visita: ${cp.last_visit_date || "não registrada"}${cp.preferences ? `\n• Preferências conhecidas: ${cp.preferences}` : ""}${cp.notes ? `\n• Observações: ${cp.notes}` : ""}`;
          }
        } catch {
          // Silencia erro — não impede o atendimento
        }
      }

      // ── SYSTEM PROMPT DA DELTA ─────────────────────────────────────────────
      //
      // Princípios de prompt engineering aplicados:
      //
      // 1. PERSONA ANTES DE REGRAS — o modelo precisa "entrar no personagem"
      //    antes de receber instruções.
      //
      // 2. CONTEXTO ESTRUTURADO EM BLOCOS — separar dados (loja, serviços,
      //    cliente) de instruções comportamentais.
      //
      // 3. INSTRUÇÕES POSITIVAS > NEGATIVAS — "sempre confirme antes de agendar"
      //    funciona melhor que "nunca agende sem confirmar".
      //
      // 4. FLUXO EXPLÍCITO COMO SEQUÊNCIA — passo a passo numerado supera
      //    regras soltas para fluxos multi-etapa como agendamento.
      //
      // 5. ANCORAGEM TEMPORAL — data de hoje no contexto evita datas passadas.
      //
      // 6. EXEMPLOS INLINE — exemplos concretos superam descrições abstratas.

      contextRef.current = `VOCÊ É A DELTA — ASSISTENTE VIRTUAL DE ${proName.toUpperCase()}

QUEM VOCÊ É:
Você é a Delta, assistente virtual desta loja no app Daily. Você atende clientes pelo chat, tira dúvidas sobre serviços e realiza agendamentos. Você representa ${proName} e fala no nome desta loja.

TOM DE VOZ:
• Fale como uma atendente simpática e eficiente — como uma amiga que trabalha no salão
• Linguagem simples e direta. Zero termos técnicos. Frases curtas.
• Use emojis com moderação (1-2 por mensagem, nunca em excesso)
• Se o cliente estiver animado, combine com ele. Se estiver apressado, seja objetiva.
• NUNCA diga que é uma IA, robô ou assistente virtual de forma técnica. Se perguntarem, diga: "Sou a Delta, assistente da ${proName}! 😊"

DADOS DA LOJA:
• Nome: ${proName}
• Local: ${(profile as any)?.location || "Não informado"}
• Horários de funcionamento: ${(profile as any)?.business_hours || "Consulte disponibilidade pelo chat"}
${(profile as any)?.avg_rating > 0 ? `• Avaliação: ⭐ ${(profile as any).avg_rating.toFixed(1)}/5` : ""}

SERVIÇOS E PRODUTOS DISPONÍVEIS:
${servicesList || "Nenhum serviço cadastrado ainda."}
${clientInfo}

HOJE É: ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}

─────────────────────────────────────────
FLUXO DE AGENDAMENTO — SIGA SEMPRE ESTA ORDEM:
─────────────────────────────────────────

PASSO 1 — ENTENDER O PEDIDO
Descubra qual serviço o cliente quer. Se houver dúvida, sugira os mais populares da lista.

PASSO 2 — COMBINAR A DATA
Pergunte a data desejada. Se o cliente disser "essa semana" ou "o quanto antes", sugira as próximas opções disponíveis pelo contexto do dia de hoje.

PASSO 3 — VERIFICAR DISPONIBILIDADE
Quando tiver o serviço e a data, USE IMEDIATAMENTE a ferramenta 'check_availability'.
🚫 REGRA CRÍTICA: NÃO mande mensagem avisando "vou verificar". Chame a ferramenta DIRETAMENTE e APENAS responda o resultado ao cliente.
→ Se tiver horários: liste os disponíveis de forma clara (ex: "Tenho 10h, 14h e 16h disponíveis 📅")
→ Se não tiver: avise com simpatia e pergunte outra data

PASSO 4 — CONFIRMAR O HORÁRIO
Quando o cliente escolher um horário, repita o resumo ANTES de agendar:
"Vou agendar: [serviço] no dia [data] às [hora]. Confirma? ✅"

PASSO 5 — EXECUTAR O AGENDAMENTO
Só após confirmação, use a ferramenta 'book_appointment'.
🚫 REGRA CRÍTICA: NÃO mande mensagem dizendo "vou agendar". Chame a ferramenta DIRETAMENTE.
→ Se der certo: comemore brevemente, avise que o agendamento foi salvo na agenda e, OBRIGATORIAMENTE, forneça o link do WhatsApp para o cliente falar com a loja: https://wa.me/55${(profile as any)?.whatsapp?.replace(/\D/g, '') || ""}
→ Se der erro: avise que o horário pode ter sido ocupado e ofereça outro

─────────────────────────────────────────
REGRAS INEGOCIÁVEIS:
─────────────────────────────────────────
• NUNCA invente horários disponíveis. Sempre use check_availability antes de citar horários.
• NUNCA confirme um agendamento sem ter sucesso na ferramenta book_appointment.
• Se o cliente pedir algo fora dos serviços listados, diga que não oferecem no momento e sugira o mais parecido.
• Se não souber responder algo sobre a loja, diga: "Não tenho essa informação, mas você pode perguntar direto para ${proName} 😊"
• Preferências mencionadas pelo cliente (horário favorito, alergias, gostos) → use save_client_preference silenciosamente, sem avisar o cliente.
• NUNCA responda algo como "Só um momento enquanto verifico". Se precisar verificar ou agendar, BASTA CHAMAR A FERRAMENTA NA MESMA RESPOSTA. O cliente não pode ficar esperando.`;

      // Welcome message — personalizada para cliente recorrente
      const proFirstName = (profile as any)?.display_name?.split(" ")[0] || proName;
      const welcomeText = isRecurring && clientFirstName
        ? `Oi, ${clientFirstName}! 💕 Que saudade! Da última vez você fez ${lastService} aqui. Quer repetir ou experimentar algo diferente hoje?`
        : `Olá! Bem-vinda à ${proName}! 🩷 Sou a Delta, assistente virtual aqui. Posso te ajudar a agendar um horário, tirar dúvidas sobre nossos serviços ou o que precisar. Como posso te ajudar?`;

      setMessages([{
        id: "welcome",
        role: "assistant",
        content: welcomeText,
        timestamp: Date.now(),
      }]);

    } catch (e) {
      console.error("[Delta] Erro ao construir contexto:", e);
      // Welcome genérico como fallback
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Olá! Sou a Delta 🩷 Como posso te ajudar hoje?",
        timestamp: Date.now(),
      }]);
    }
  }

  // ── Tools do Gemini ──────────────────────────────────────────────────────────
  const DELTA_TOOLS = [
    {
      functionDeclarations: [
        {
          name: "check_availability",
          description: "Verifica os horários disponíveis para um serviço em uma data específica. Use sempre que o cliente informar uma data — nunca invente horários.",
          parameters: {
            type: "object",
            properties: {
              service_id: {
                type: "string",
                description: "O ID único do serviço conforme listado nos dados da loja. Ex: 'abc123-...'"
              },
              date: {
                type: "string",
                description: "A data desejada no formato YYYY-MM-DD. Ex: 2026-05-20. Use a data de hoje como referência para calcular datas relativas como 'amanhã' ou 'próxima sexta'."
              },
            },
            required: ["service_id", "date"],
          },
        },
        {
          name: "book_appointment",
          description: "Realiza o agendamento no sistema. Use SOMENTE após o cliente confirmar o serviço, a data e o horário escolhido. Nunca use sem confirmação explícita do cliente.",
          parameters: {
            type: "object",
            properties: {
              service_id: {
                type: "string",
                description: "O ID único do serviço."
              },
              date: {
                type: "string",
                description: "A data no formato YYYY-MM-DD."
              },
              time: {
                type: "string",
                description: "O horário no formato HH:MM. Deve ser um dos horários retornados por check_availability."
              },
              client_name: {
                type: "string",
                description: "Nome do cliente para registrar no agendamento. Se não souber, use 'Cliente'."
              },
            },
            required: ["service_id", "date", "time"],
          },
        },
        {
          name: "save_client_preference",
          description: "Salva silenciosamente uma preferência ou informação relevante do cliente para personalizar atendimentos futuros. Use sem avisar o cliente — apenas registre. Exemplos: horário favorito, alergia a produto, tipo de serviço preferido, forma de pagamento.",
          parameters: {
            type: "object",
            properties: {
              preference: {
                type: "string",
                description: "A preferência em linguagem natural. Ex: 'Prefere horários da tarde', 'Alérgica a acrílico', 'Gosta de nail art com pedrinhas'."
              },
            },
            required: ["preference"],
          },
        },
      ],
    },
  ];

  // ── Chamada ao Gemini com tools ──────────────────────────────────────────────
  const callGeminiWithTools = async (contents: GeminiContent[]): Promise<any> => {
    return await callGeminiProxy({
      system_instruction: { parts: [{ text: contextRef.current }] },
      contents,
      tools: DELTA_TOOLS,
      generationConfig: {
        temperature: 0.3,   // Baixo: Delta precisa ser precisa em datas e horários
        maxOutputTokens: 1024,
      },
    });
  };

  // ── Processamento de resposta com recursão segura ────────────────────────────
  const processResponse = async (
    data: any,
    currentContents: GeminiContent[],
    depth: number = 0
  ): Promise<string> => {

    if (depth >= MAX_RECURSION_DEPTH) {
      console.warn("[Delta] Limite de recursão atingido");
      return "Tive um problema para processar esse pedido 😅 Pode tentar de novo?";
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    if (parts.length === 0) return "Hmm, não consegui processar. Pode repetir?";

    const textPart = parts.find((p: any) => p.text);
    const functionCallPart = parts.find((p: any) => p.functionCall);

    // ── Execução de tool ───────────────────────────────────────────────────────
    if (functionCallPart) {
      const call = functionCallPart.functionCall;
      let functionResult: Record<string, any> = {};

      // check_availability
      if (call.name === "check_availability") {
        const { service_id, date } = call.args;
        try {
          const dt = new Date(date + "T12:00:00");
          const { available } = await getAvailableSlots(professionalId, service_id, dt);
          functionResult = {
            success: true,
            available_slots: available,
            count: available.length,
            message: available.length === 0
              ? "Nenhum horário disponível nesta data."
              : `${available.length} horário(s) disponível(is).`,
          };
        } catch {
          functionResult = { success: false, error: "Não foi possível verificar a agenda. Tente novamente." };
        }
      }

      // book_appointment
      else if (call.name === "book_appointment") {
        if (!consumerId) {
          functionResult = {
            success: false,
            error: "Cliente não está logado. Peça para o cliente fazer login no app antes de agendar.",
          };
        } else {
          const { service_id, date, time } = call.args;
          try {
            const dt = new Date(date + "T12:00:00");
            const res = await bookSlot(service_id, dt, time, consumerId, professionalId);
            functionResult = {
              success: res.success,
              auto_approved: res.autoApproved,
              message: res.success
                ? res.autoApproved
                  ? "Agendamento confirmado no sistema com sucesso."
                  : "Agendamento enviado para aprovação do profissional."
                : "Horário indisponível — pode ter sido ocupado agora. Ofereça outro horário.",
            };
          } catch {
            functionResult = { success: false, error: "Erro ao salvar no banco de dados." };
          }
        }
      }

      // save_client_preference — silencioso, não impacta o fluxo
      else if (call.name === "save_client_preference" && consumerId) {
        try {
          const { data: existing } = await supabase
            .from("client_profiles" as any)
            .select("id, preferences")
            .eq("client_id", consumerId)
            .eq("professional_id", professionalId)
            .maybeSingle();

          if (existing) {
            const current = (existing as any).preferences || "";
            const updated = current
              ? `${current}; ${call.args.preference}`
              : call.args.preference;
            await supabase
              .from("client_profiles" as any)
              .update({ preferences: updated, updated_at: new Date().toISOString() })
              .eq("id", (existing as any).id);
          } else {
            await supabase.from("client_profiles" as any).insert({
              client_id: consumerId,
              professional_id: professionalId,
              preferences: call.args.preference,
              visit_count: 0,
            });
          }
          functionResult = { success: true };
        } catch {
          functionResult = { success: false };
        }
      }

      // Adiciona tool call + resultado no histórico e chama Gemini novamente
      const modelParts: any[] = [];
      if (textPart) modelParts.push(textPart);
      modelParts.push(functionCallPart);

      currentContents.push({
        role: "model",
        parts: modelParts,
      });

      currentContents.push({
        role: "function",
        parts: [{
          functionResponse: {
            name: call.name,
            response: { name: call.name, content: functionResult },
          },
        }],
      });

      const nextData = await callGeminiWithTools(currentContents);
      return await processResponse(nextData, currentContents, depth + 1);
    }

    // ── Resposta de texto ──────────────────────────────────────────────────────
    if (textPart) {
      currentContents.push({ role: "model", parts: [{ text: textPart.text }] });
      return textPart.text;
    }

    return "Desculpe, não entendi. Pode repetir?";
  };

  // ── sendMessage ──────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsLoading(true);

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      historyRef.current.push({ role: "user", parts: [{ text: text.trim() }] });

      // Trim do histórico — entries de functionCall/functionResponse são grandes
      if (historyRef.current.length > MAX_HISTORY_ENTRIES) {
        historyRef.current = historyRef.current.slice(-MAX_HISTORY_ENTRIES);
      }

      const thinkingId = `ai_${Date.now()}`;
      setMessages(prev => [...prev, {
        id: thinkingId,
        role: "assistant",
        content: "...",
        timestamp: Date.now(),
      }]);

      const data = await callGeminiWithTools(historyRef.current);
      const finalResponse = await processResponse(data, historyRef.current);

      setMessages(prev => prev.map(m => 
        m.id === thinkingId 
          ? { ...m, content: finalResponse }
          : m
      ));

    } catch (e: any) {
      console.error("[Delta] sendMessage error:", e?.message || e);

      const errorMessages: Record<string, string> = {
        RATE_LIMIT: "Muitas mensagens de uma vez 🕐 Espera uns segundos e tenta de novo!",
        TIMEOUT: "Demorou mais que o esperado... Tenta de novo em instantes! ⏳",
        AUTH_EXPIRED: "Sua sessão expirou 🔒 Feche e abra o app novamente.",
        SERVER_ERROR: "Estou sobrecarregada no momento 🔄 Tenta de novo em alguns segundos!",
        NETWORK_ERROR: "Parece que a internet está instável 📶 Verifica sua conexão e tenta de novo.",
      };

      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: errorMessages[e?.message] || "Tive um probleminha aqui 😅 Pode tentar de novo?",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [professionalId, consumerId, getAvailableSlots, bookSlot]);

  return { messages, isLoading, sendMessage };
}
