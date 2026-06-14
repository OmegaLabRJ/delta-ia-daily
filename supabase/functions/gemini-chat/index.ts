import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

// CORS: '*' é aceitável para app mobile-only (não há domain de origem).
// Se expor via web, restringir para o domínio específico.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Rate Limiting em memória (por user, por instância da Edge Function) ─────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;       // máx 20 requests
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

// Limpeza periódica para não vazar memória em instâncias de longa duração
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
    // ── 1. AUTENTICAÇÃO ──────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Valida o JWT do Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Service role é usado SOMENTE para validar o JWT — nenhuma query de dados passa por aqui
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

    // ── 2. RATE LIMITING ─────────────────────────────────────────────────────
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Muitas requisições. Aguarde um momento antes de tentar novamente.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 3. VALIDAÇÃO DO BODY ─────────────────────────────────────────────────
    const body = await req.json()
    const { contents, system_instruction, tools, generationConfig } = body

    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Campo "contents" é obrigatório e deve ser um array.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sanity check: limita tamanho do histórico para evitar abuse
    if (contents.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Histórico de conversa muito longo. Limite: 100 mensagens.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 4. CHAMADA AO GEMINI ─────────────────────────────────────────────────
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set in Supabase Secrets');
      return new Response(
        JSON.stringify({ error: 'Configuração incompleta no servidor.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geminiBody = JSON.stringify({
      contents,
      system_instruction,
      tools,
      generationConfig,
    });

    // Retry com backoff exponencial para 429 (rate limit do Gemini)
    const MAX_RETRIES = 3;
    let lastResponse: Response | null = null;
    let lastData: any = null;

    const streamParam = body.stream ? "&alt=sse" : "";

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Backoff exponencial: 1s, 2s, 4s + jitter
        const baseDelay = Math.pow(2, attempt - 1) * 1000;
        const jitter = Math.random() * 500;
        console.log(`[Gemini] Retry ${attempt}/${MAX_RETRIES} após ${baseDelay + jitter}ms`);
        await new Promise(r => setTimeout(r, baseDelay + jitter));
      }

      lastResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}${streamParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
      });

      // Se for stream e for sucesso, não tentamos ler o json e retornamos direto
      if (body.stream && lastResponse.status === 200) {
        return new Response(lastResponse.body, {
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
        });
      }

      lastData = await lastResponse.json();

      // Se for sucesso ou erro não retryable, sai do loop
      // Retentamos em 429 (Rate Limit) e 503 (Service Unavailable / Overloaded)
      if (lastResponse.status !== 429 && lastResponse.status !== 503) break;

      console.warn(`[Gemini] ${lastResponse.status} Overloaded/Rate Limited (tentativa ${attempt + 1})`);
    }

    if (!lastResponse!.ok) {
      console.error('Gemini API error:', lastData);

      // 429 e 503 do Gemini viram 503 para o client
      const clientStatus = (lastResponse!.status === 429 || lastResponse!.status === 503) ? 503 : lastResponse!.status;
      const clientError = (lastResponse!.status === 429 || lastResponse!.status === 503)
        ? 'A IA está sobrecarregada no momento. Aguarde alguns segundos e tente novamente.'
        : 'Erro na comunicação com a IA.';

      return new Response(
        JSON.stringify({ error: clientError, details: lastData, gemini_status: lastResponse!.status }),
        { status: clientStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify(lastData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Edge Function error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
