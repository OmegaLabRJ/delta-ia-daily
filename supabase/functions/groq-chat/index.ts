import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate Limiting em memória (por user, por instância da Edge Function)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30; // máx 30 requests pro Groq
const RATE_LIMIT_WINDOW_MS = 60_000; // por minuto

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. AUTENTICAÇÃO
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: { persistSession: false }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. ENFORCEMENT DE COTA DE IA E RATE LIMITING
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Muitas requisições. Aguarde um momento antes de tentar novamente.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: usage } = await supabase.rpc('get_or_create_ai_usage', { p_user_id: user.id });
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('plan_id, status')
      .eq('user_id', user.id)
      .maybeSingle();
      
    const isActive = sub?.status === 'active' || sub?.status === 'trial';
    const userPlan = isActive ? (sub?.plan_id || 'free') : 'free';
    const CHAT_LIMITS: Record<string, number> = { free: 50, creator: 1500, pro: 999999 };
    const maxChatRequests = CHAT_LIMITS[userPlan] || 50;
    const currentChatRequests = usage?.[0]?.requests_count || 0;
    
    if (currentChatRequests >= maxChatRequests) {
      return new Response(
        JSON.stringify({ error: `Limite de ${maxChatRequests} mensagens da IA atingido para o plano ${userPlan}. Faça upgrade para continuar.` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Incrementa a cota de forma atômica antes do stream para evitar race condition
    const { data: newRequestsCount, error: rpcError } = await supabase.rpc('increment_ai_usage', { p_user_id: user.id });
    if (rpcError) {
      console.error('Erro ao incrementar uso:', rpcError);
    }

    // 3. VALIDAÇÃO DO BODY (Espera formato do Gemini)
    const body = await req.json()
    const { contents, system_instruction, generationConfig, stream, tools } = body

    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Campo "contents" é obrigatório e deve ser um array.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (contents.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Histórico de conversa muito longo. Limite: 100 mensagens.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. CHAMADA AO GROQ
    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) {
      console.error('GROQ_API_KEY is not set in Supabase Secrets');
      return new Response(
        JSON.stringify({ error: 'Configuração incompleta no servidor (Groq API Key ausente).' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Traduzir Tools de Gemini para OpenAI/Groq format
    const openaiTools: any[] = [];
    if (tools && Array.isArray(tools)) {
      for (const t of tools) {
        if (t.functionDeclarations) {
          for (const fd of t.functionDeclarations) {
            openaiTools.push({
              type: "function",
              function: {
                name: fd.name,
                description: fd.description,
                parameters: fd.parameters || {}
              }
            });
          }
        }
      }
    }

    // Traduzir Histórico de Gemini para OpenAI/Groq format
    const groqMessages: any[] = [];
    if (system_instruction?.parts?.[0]?.text) {
      groqMessages.push({ role: 'system', content: system_instruction.parts[0].text });
    }

    for (const content of contents) {
      if (content.role === 'model') {
        const textParts = content.parts?.filter((p: any) => p.text).map((p: any) => p.text).join('') || '';
        const functionCall = content.parts?.find((p: any) => p.functionCall)?.functionCall;
        
        let msg: any = { role: 'assistant' };
        if (textParts) msg.content = textParts;
        
        if (functionCall) {
          msg.tool_calls = [{
            id: `call_${Math.random().toString(36).substring(7)}`,
            type: "function",
            function: {
              name: functionCall.name,
              arguments: JSON.stringify(functionCall.args || {})
            }
          }];
          if (!msg.content) msg.content = null; // Requisito estrito de alguns modelos
        }
        groqMessages.push(msg);
      } else if (content.role === 'function') {
        const functionResponse = content.parts?.find((p: any) => p.functionResponse)?.functionResponse;
        if (functionResponse) {
          // Achar o tool_call_id correspondente no histórico (fallback pra random se não achar)
          let matchedCallId = `call_${Math.random().toString(36).substring(7)}`; 
          for (let i = groqMessages.length - 1; i >= 0; i--) {
            if (groqMessages[i].role === 'assistant' && groqMessages[i].tool_calls) {
              const call = groqMessages[i].tool_calls.find((tc: any) => tc.function.name === functionResponse.name);
              if (call) {
                matchedCallId = call.id;
                break;
              }
            }
          }
          
          groqMessages.push({
            role: 'tool',
            tool_call_id: matchedCallId,
            content: JSON.stringify(functionResponse.response || {})
          });
        }
      } else {
        // role === 'user'
        let text = content.parts?.map((p: any) => p.text).join('') || '';
        groqMessages.push({ role: 'user', content: text });
      }
    }

    const groqBody: any = {
      model: 'llama-3.3-70b-versatile',
      messages: groqMessages,
      temperature: generationConfig?.temperature ?? 0.7,
      max_tokens: generationConfig?.maxOutputTokens ?? undefined,
      stream: !!stream
    };
    
    if (openaiTools.length > 0) {
      groqBody.tools = openaiTools;
      groqBody.tool_choice = "auto";
    }

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(groqBody),
    });

    if (!response.ok) {
       const errorData = await response.text();
       console.error('[Groq] API Error:', errorData);
       const status = response.status;
       const clientError = (status === 429 || status === 503) ? 'A IA está sobrecarregada.' : 'Erro na comunicação com a IA (Groq).';
       return new Response(
         JSON.stringify({ error: clientError, details: errorData, groq_status: status }),
         { status: status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    if (stream) {
      // Traduzir SSE Stream da OpenAI/Groq para formato esperado do Gemini
      let buffer = '';
      
      let accumulatingToolCall = false;
      let toolCallName = "";
      let toolCallArgsRaw = "";
      
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          buffer += new TextDecoder().decode(chunk);
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; 
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6).trim();
              if (dataStr === '[DONE]') {
                 if (accumulatingToolCall && toolCallName) {
                    emitToolCall(controller, toolCallName, toolCallArgsRaw);
                 }
                 continue;
              }
              try {
                const data = JSON.parse(dataStr);
                const delta = data.choices?.[0]?.delta;
                
                if (!delta) continue;
                
                if (delta.tool_calls && delta.tool_calls.length > 0) {
                  // LIMITAÇÃO CONHECIDA: assume 1 tool call por resposta (tc[0] fixo).
                  // Se o modelo algum dia chamar múltiplas ferramentas na mesma resposta
                  // (parallel tool calls), os argumentos vão se misturar. Resolver
                  // quando/se isso for necessário, usando um dicionário por tc.index.
                  accumulatingToolCall = true;
                  const tc = delta.tool_calls[0];
                  if (tc.function?.name) toolCallName += tc.function.name;
                  if (tc.function?.arguments) toolCallArgsRaw += tc.function.arguments;
                }
                
                if (delta.content) {
                  const geminiChunk = {
                    candidates: [{ content: { parts: [{ text: delta.content }], role: 'model' } }]
                  };
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(geminiChunk)}\n\n`));
                }
                
                if (data.choices?.[0]?.finish_reason === "tool_calls") {
                   if (accumulatingToolCall && toolCallName) {
                      emitToolCall(controller, toolCallName, toolCallArgsRaw);
                      accumulatingToolCall = false;
                      toolCallName = "";
                      toolCallArgsRaw = "";
                   }
                }
              } catch (e) {
                // Ignore parse errors on partial data
              }
            }
          }
        },
        flush(controller) {
           if (accumulatingToolCall && toolCallName) {
              emitToolCall(controller, toolCallName, toolCallArgsRaw);
           }
        }
      });
      
      function emitToolCall(controller: any, name: string, argsRaw: string) {
          let parsedArgs = {};
          try {
             parsedArgs = argsRaw ? JSON.parse(argsRaw) : {};
          } catch(e) {
             console.error("Groq JSON Parse Error nos argumentos da tool:", argsRaw);
             parsedArgs = {}; 
          }
          
          const geminiChunk = {
            candidates: [{ 
              content: { 
                parts: [{ 
                  functionCall: { name: name, args: parsedArgs }
                }], 
                role: 'model' 
              } 
            }]
          };
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(geminiChunk)}\n\n`));
      }

      return new Response(response.body!.pipeThrough(transformStream), {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
      });
    }

    // Não-stream
    const groqData = await response.json();
    const choice = groqData.choices?.[0];
    const textResponse = choice?.message?.content || '';
    const toolCalls = choice?.message?.tool_calls;

    const parts: any[] = [];
    if (textResponse) {
      parts.push({ text: textResponse });
    }
    
    if (toolCalls && toolCalls.length > 0) {
      const tc = toolCalls[0];
      let parsedArgs = {};
      try {
         parsedArgs = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch(e) {
         console.error("Groq JSON Parse Error:", tc.function.arguments);
      }
      parts.push({
        functionCall: {
          name: tc.function.name,
          args: parsedArgs
        }
      });
    }

    const geminiFormatData = {
      candidates: [
        { content: { parts: parts, role: "model" } }
      ]
    };

    return new Response(JSON.stringify(geminiFormatData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    console.error('Edge Function error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
