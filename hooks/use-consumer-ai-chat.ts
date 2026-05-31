import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useSchedule } from "@/hooks/use-schedule";
import { callGeminiProxy, GeminiContent, resetRateLimit } from "@/lib/ai";

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
  const storeTypeRef = useRef<"service_only" | "product_only" | "both">("service_only");
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

      const hasProducts = services.some(i => i.item_type === "product");
      const hasServices = services.some(i => i.item_type === "service");
      const storeType = hasProducts && hasServices ? "both" 
                      : hasProducts ? "product_only" 
                      : "service_only";
      storeTypeRef.current = storeType;


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
Você é a Delta, assistente virtual desta loja no app Daily. Você atende clientes pelo chat, tira dúvidas e realiza vendas ou agendamentos. Você representa ${proName} e fala no nome desta loja.

${storeType === 'service_only' ? `Essa loja oferece apenas SERVIÇOS com agendamento. Nunca mencione produtos ou compras físicas. Use apenas o fluxo de agendamento.` : ''}
${storeType === 'product_only' ? `Essa loja oferece apenas PRODUTOS para compra. Nunca mencione agendamento de horários. Use apenas o fluxo de compra de itens.` : ''}
${storeType === 'both' ? `Essa loja oferece SERVIÇOS e PRODUTOS. Identifique a intenção do cliente:
- Se quiser COMPRAR algo físico (roupa, acessório, etc) → fluxo de compra
- Se quiser AGENDAR algo (procedimento, serviço) → fluxo de agendamento
- Se quiser AMBOS, responda aos dois fluxos na mesma mensagem de forma natural.` : ''}

TOM DE VOZ:
• Fale como uma atendente simpática e eficiente — como uma amiga que trabalha na loja
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
${servicesList || "Nenhum item cadastrado ainda."}
${clientInfo}

HOJE É: ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
E AGORA SÃO: ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}

${storeType === 'service_only' || storeType === 'both' ? `─────────────────────────────────────────
FLUXO DE AGENDAMENTO — SIGA SEMPRE ESTA ORDEM:
─────────────────────────────────────────

PASSO 1 — INTENÇÃO DE AGENDAR DETECTADA
Se o cliente demonstrar intenção de agendar (ex: "tem horário?", "quero marcar", "tem vaga hoje?"), NÃO faça perguntas.
Chame IMEDIATAMENTE a ferramenta 'get_week_availability'.
Ela já retorna todos os serviços com preços e horários de hoje e amanhã.
Se o cliente pedir para uma data além de amanhã, peça gentilmente para ele chamar no WhatsApp: https://wa.me/55${(profile as any)?.whatsapp?.replace(/\D/g, '') || ""}

PASSO 2 — APRESENTAR TUDO DE UMA VEZ
Com o resultado em mãos, responda em uma mensagem só em formato de texto limpo. Exemplo:

"Temos sim! 🎉
💅 Acrigel — R$120 → 10h, 14h, 16h
💆 Massagem — R$80 → 11h, 15h
✂️ Corte — R$50 → só amanhã
Qual você prefere?"

Regras da apresentação:
• Se o cliente não pediu uma data específica, apresente APENAS a primeira data/dia disponível retornada pela ferramenta. NUNCA liste a semana toda de uma vez para evitar erro.
• Se o serviço tiver horário hoje → liste os horários
• Se não tiver hoje → diga "só amanhã" ou "sem horário hoje"
• NUNCA explique por que os horários são assim. Sem "dependendo do procedimento", sem "o tempo varia". Só apresente o resultado.
• Máximo 1 emoji por linha. Mensagem curta.

PASSO 3 — CLIENTE ESCOLHEU SERVIÇO E HORÁRIO
Repita o resumo e confirme:
"Ótimo! Vou agendar [serviço] hoje às [hora]. Confirma? ✅"

PASSO 4 — EXECUTAR O AGENDAMENTO
Só após confirmação, use 'book_appointment'.
→ Sucesso: "Agendado! 🎉 Qualquer dúvida fala com a gente pelo WhatsApp: https://wa.me/55${(profile as any)?.whatsapp?.replace(/\D/g, '') || ""}"
→ Erro: "Esse horário acabou de ser ocupado 😅 Quer um desses: [lista restante]?"

─────────────────────────────────────────
REGRAS INEGOCIÁVEIS DO AGENDAMENTO:
─────────────────────────────────────────
• NUNCA invente horários. Sempre use get_week_availability antes de citar qualquer horário. Se pedirem para além de amanhã, redirecione pro WhatsApp.
• NUNCA confirme agendamento sem sucesso no book_appointment.
• NUNCA explique questões técnicas de tempo, duração ou intervalo ao cliente. Isso é problema da profissional, não do cliente.
• Se o cliente pedir serviço fora da lista → "Não temos esse serviço ainda, mas posso agendar [mais parecido]. Quer?"
• Preferências do cliente → salve com save_client_preference sem avisar.
• NUNCA responda algo como "Só um momento enquanto verifico". Se precisar verificar ou agendar, BASTA CHAMAR A FERRAMENTA NA MESMA RESPOSTA. O cliente não pode ficar esperando.
• Datas relativas: quando o cliente disser "hoje", "amanhã", "segunda" — calcule sempre a partir da data de hoje. NUNCA pergunte "qual data exata?". Assuma sempre a mais próxima no futuro.
• A hora atual está no seu contexto. Se um horário já passou hoje, ele não existe. Se todos os horários de hoje já passaram, avise que hoje não tem mais vagas e liste os horários de amanhã.` : ''}

${storeType === 'product_only' || storeType === 'both' ? `─────────────────────────────────────────
FLUXO DE COMPRA DE ITENS — SIGA ESTA ORDEM:
─────────────────────────────────────────

PASSO 1 — INTENÇÃO DE COMPRA DETECTADA
Se o cliente quiser comprar um item, chame get_products imediatamente.
Não pergunte qual item antes de buscar — mostre tudo de uma vez.

PASSO 2 — APRESENTAR OS PRODUTOS
"Temos esses itens lindos disponíveis:
👜 Cinto de couro — R$89
💍 Anel prata — R$120
👕 Camiseta — R$65
Qual te interessou?"

PASSO 3 — CLIENTE ESCOLHEU
"Ótima escolha! Para combinar a entrega e forma de pagamento, fala com a gente pelo WhatsApp 👇
https://wa.me/55${(profile as any)?.whatsapp?.replace(/\D/g, '') || ""}"

REGRAS INEGOCIÁVEIS DA COMPRA:
• Nunca invente produtos — use sempre get_products.
• Nunca prometa prazo de entrega ou frete — isso é combinado pelo WhatsApp.
• Nunca processe pagamento — direcione sempre pro WhatsApp.` : ''}`;

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
  // ── Chamada ao Gemini com tools ──────────────────────────────────────────────
  const callGeminiWithTools = async (contents: GeminiContent[]): Promise<any> => {
    const storeType = storeTypeRef.current;
    
    const toolsConfig = {
      functionDeclarations: [] as any[]
    };

    if (storeType === "service_only" || storeType === "both") {
      toolsConfig.functionDeclarations.push(
        {
          name: "get_week_availability",
          description: "Busca horários disponíveis de hoje e amanhã para todos os serviços. Se o cliente quiser agendar para depois de amanhã, responda pedindo para ele chamar no WhatsApp.",
          parameters: { type: "object", properties: {} },
        },
        {
          name: "book_appointment",
          description: "Realiza o agendamento no sistema. Use SOMENTE após o cliente confirmar o serviço, a data e o horário escolhido. Nunca use sem confirmação explícita do cliente.",
          parameters: {
            type: "object",
            properties: {
              service_id: { type: "string", description: "O ID único do serviço." },
              date: { type: "string", description: "A data no formato YYYY-MM-DD." },
              time: { type: "string", description: "O horário no formato HH:MM. Deve ser um dos horários retornados por check_availability." },
              client_name: { type: "string", description: "Nome do cliente para registrar no agendamento. Se não souber, use 'Cliente'." },
            },
            required: ["service_id", "date", "time"],
          },
        }
      );
    }

    if (storeType === "product_only" || storeType === "both") {
      toolsConfig.functionDeclarations.push(
        {
          name: "get_products",
          description: "Busca os produtos disponíveis na loja. Use quando o cliente demonstrar intenção de comprar um item.",
          parameters: { type: "object", properties: {} },
        }
      );
    }

    toolsConfig.functionDeclarations.push({
      name: "save_client_preference",
      description: "Salva silenciosamente uma preferência ou informação relevante do cliente para personalizar atendimentos futuros. Use sem avisar o cliente — apenas registre. Exemplos: horário favorito, alergia a produto, tipo de serviço preferido, forma de pagamento.",
      parameters: {
        type: "object",
        properties: {
          preference: { type: "string", description: "A preferência em linguagem natural. Ex: 'Prefere horários da tarde', 'Alérgica a acrílico', 'Gosta de nail art com pedrinhas'." },
        },
        required: ["preference"],
      },
    });

    return await callGeminiProxy({
      system_instruction: { parts: [{ text: contextRef.current }] },
      contents,
      tools: [toolsConfig],
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

      // get_week_availability
      if (call.name === "get_week_availability") {
        try {
          const hoje = new Date();
          // Pega data de hoje como string YYYY-MM-DD
          const dtStart = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
          // Pega data daqui a 1 dia (hoje + amanhã = 2 dias)
          const nextWeek = new Date(hoje);
          nextWeek.setDate(hoje.getDate() + 1);
          const dtEnd = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, "0")}-${String(nextWeek.getDate()).padStart(2, "0")}`;
          
          // Pega hora atual
          const currentTime = hoje.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

          const { data, error } = await supabase.rpc("get_week_availability", {
            p_professional_id: professionalId,
            p_date_start: dtStart,
            p_date_end: dtEnd,
            p_current_time: currentTime
          });
          if (error) throw error;
          
          // COMPRESSÃO DE PAYLOAD: Reduz drastically o JSON para não estourar o limite de tokens do Gemini
          const compactData = data?.map((day: any) => ({
            d: day.date,
            s: day.services.map((s: any) => ({
              id: s.service_id,
              n: s.service_name,
              p: s.price,
              t: s.available_times.join(',')
            }))
          }));

          functionResult = {
            success: true,
            availability: compactData,
          };
        } catch (e) {
          console.error("[Delta] RPC error:", e);
          functionResult = { success: false, error: "Não foi possível carregar os horários. Tente novamente." };
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

      // get_products
      else if (call.name === "get_products") {
        try {
          const { data, error } = await supabase
            .from("marketplace_items" as any)
            .select("id, name, price, description, image_url")
            .eq("seller_id", professionalId)
            .eq("item_type", "product")
            .eq("is_active", true);

          if (error) throw error;

          functionResult = {
            success: true,
            products: data || [],
          };
        } catch (e: any) {
          console.error("[Delta] Erro get_products:", e);
          functionResult = { success: false, error: e?.message || "Erro ao buscar produtos." };
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

      resetRateLimit(); // Evita bloqueio local no envio da resposta da tool
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
