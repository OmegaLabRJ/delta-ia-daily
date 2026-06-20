import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase";

export type GeminiRole = "user" | "model" | "function";
export type GeminiPart = { text?: string; functionCall?: any; functionResponse?: any };
export type GeminiContent = { role: GeminiRole; parts: GeminiPart[] };

export interface GeminiProxyParams {
  contents: GeminiContent[];
  system_instruction?: { parts: [{ text: string }] };
  tools?: any[];
  generationConfig?: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
    [key: string]: any;
  };
}

// Rate limiting: previne spam de chamadas à API
let lastCallTime = 0;
const MIN_CALL_INTERVAL_MS = 2000;

// Permite reset do rate limit por chamadas encadeadas (ex: tool → callGeminiSimple)
export function resetRateLimit() {
  lastCallTime = 0;
}

/**
 * Invoca a Edge Function 'gemini-chat' no Supabase para processar requisições de IA
 * de forma segura, mantendo a API KEY escondida no servidor.
 *
 * Inclui retry automático para erros de sobrecarga (503) do Gemini.
 */
export async function callGeminiProxy(params: GeminiProxyParams, onChunk?: (text: string) => void) {
  const now = Date.now();
  if (now - lastCallTime < MIN_CALL_INTERVAL_MS) {
    throw new Error("Aguarde um momento antes de enviar outra mensagem.");
  }
  lastCallTime = now;

  const TIMEOUT_MS = 45000;
  const CLIENT_RETRIES = 1; // 1 retry no client por provedor

  // Tenta Groq primeiro, se der erro (503, 429, timeout), cai pro Gemini
  const providers = ["groq-chat", "gemini-chat"];

  for (const provider of providers) {
    for (let attempt = 0; attempt <= CLIENT_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = attempt * 3000 + Math.random() * 1000;
        console.log(`[AI] Client retry ${attempt}/${CLIENT_RETRIES} no ${provider} após ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        lastCallTime = 0;
      }

      let timeoutId: any;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS);
      });

      try {
        let response: any;

        if (onChunk) {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || SUPABASE_ANON_KEY;

          console.log(`[AI] Chamando Edge Function: ${provider}...`);

          const fetchRes = await fetch(`${SUPABASE_URL}/functions/v1/${provider}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ ...params, stream: true })
          });
          
          if (!fetchRes.ok) {
             response = { error: { status: fetchRes.status, message: await fetchRes.text() } };
          } else {
             const reader = fetchRes.body?.getReader();
             const decoder = new TextDecoder("utf-8");
             let fullText = "";
             let functionCall: any = null;
             
             if (reader) {
               while (true) {
                 const { done, value } = await reader.read();
                 if (done) break;
                 
                 const chunk = decoder.decode(value, { stream: true });
                 const lines = chunk.split("\n");
                 for (const line of lines) {
                   if (line.startsWith("data: ")) {
                     const dataStr = line.slice(6);
                     if (dataStr.trim() === "[DONE]") continue;
                     try {
                       const data = JSON.parse(dataStr);
                       const responseParts = data?.candidates?.[0]?.content?.parts || [];
                       
                       for (const part of responseParts) {
                         if (part?.text) {
                           fullText += part.text;
                           onChunk(fullText);
                         }
                         
                         if (part?.functionCall) {
                           functionCall = part.functionCall;
                         }
                       }
                     } catch (e) {}
                   }
                 }
               }
             }
             
             const parts: any[] = [];
             if (fullText) parts.push({ text: fullText });
             if (functionCall) parts.push({ functionCall });
             
             return { candidates: [{ content: { parts } }] };
          }
        } else {
          response = await Promise.race([
            supabase.functions.invoke(provider, { body: params }),
            timeoutPromise
          ]);
        }

        if (response.error) {
          const status = response.error?.status || response.error?.context?.status;
          const errorBody = typeof response.error?.message === 'string'
            ? response.error.message
            : JSON.stringify(response.error);

          console.error(`[AI] Edge Function ${provider} error (status ${status}):`, errorBody);

          // Erro de autenticação não faz sentido tentar em outro provedor (é erro do user)
          if (status === 401) {
            throw new Error("AUTH_EXPIRED");
          }

          // Se for 429 ou 503, podemos tentar retry no mesmo provedor
          if ((status === 429 || status === 503) && attempt < CLIENT_RETRIES) {
            console.warn(`[AI] ${provider} sobrecarregado, tentando novamente...`);
            continue;
          }

          // Se falhou todos os retries ou foi outro erro (500), dá 'break' pra ir pro próximo provedor
          break;
        }

        // Sucesso!
        return response.data;
      } catch (e: any) {
        if (["AUTH_EXPIRED"].includes(e.message)) {
          throw e; // não tenta fallback
        }

        if (attempt < CLIENT_RETRIES && e.message !== "TIMEOUT") {
          console.warn(`[AI] Erro de rede no ${provider}, tentando novamente...`);
          continue;
        }

        // Falhou, vai pro próximo provider
        break; 
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }
  }

  throw new Error("SERVER_ERROR");
}

/**
 * Atalho para chamadas de chat simples (texto puro)
 */
export async function callGeminiSimple(
  prompt: string,
  systemPrompt?: string,
  history: { role: "user" | "model"; text: string }[] = []
): Promise<string> {
  const contents: GeminiContent[] = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  contents.push({
    role: "user",
    parts: [{ text: prompt }]
  });

  const response = await callGeminiProxy({
    contents,
    system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    generationConfig: { temperature: 0.8, maxOutputTokens: 2048 }
  });

  return response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/**
 * Registra o feedback do usuário sobre uma ação sugerida pela IA
 */
export async function trackAIFeedback(professionalId: string, actionType: string, feedback: 'edited' | 'cancelled' | 'accepted') {
  try {
    await supabase.from("ai_action_feedbacks" as any).insert({
      user_id: professionalId,
      action_type: actionType,
      feedback: feedback
    });
  } catch (e) {
    console.log("Erro ao registrar feedback da IA:", e);
  }
}
