import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Usando Hugging Face Serverless API (FLUX.1-dev para maior qualidade)
const HF_MODEL = "black-forest-labs/FLUX.1-dev";
const HF_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Rate Limiting em memória (por user, por instância da Edge Function) ─────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;       // máx 5 imagens geradas por minuto
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minuto

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. AUTENTICAÇÃO RIGOROSA ─────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
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

    const userId = user.id;

    // ── 2. ENFORCEMENT DE COTA DE IA E RATE LIMITING ────────────────────────
    if (!checkRateLimit(userId)) {
      return new Response(
        JSON.stringify({ error: 'Muitas requisições. Aguarde um momento antes de gerar mais imagens.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: usage } = await supabase.rpc('get_or_create_ai_usage', { p_user_id: userId });
    
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('plan_id, status')
      .eq('user_id', userId)
      .maybeSingle();
      
    const isActive = sub?.status === 'active' || sub?.status === 'trial';
    const userPlan = isActive ? (sub?.plan_id || 'free') : 'free';
    const IMAGE_LIMITS: Record<string, number> = { free: 3, creator: 15, pro: 999999 };
    const maxImages = IMAGE_LIMITS[userPlan] || 3;
    const currentImages = usage?.[0]?.images_generated || 0;
    
    if (currentImages >= maxImages) {
      return new Response(
        JSON.stringify({ error: `Limite de ${maxImages} imagens geradas atingido para o plano ${userPlan}. Faça upgrade para continuar.` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt } = await req.json()
    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Campo "prompt" é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const hfApiKey = Deno.env.get('HUGGINGFACE_API_KEY')
    if (!hfApiKey) {
      return new Response(
        JSON.stringify({ error: 'HUGGINGFACE_API_KEY não configurada no servidor.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Chama Hugging Face API ─────────────────────────────────────────────
    console.log(`[generate-image] Calling HF ${HF_MODEL} for userId=${userId}, prompt="${prompt.slice(0, 80)}..."`)
    
    const response = await fetch(HF_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(90_000), // 90s — FLUX.1-dev pode levar 60-90s em cold start
      headers: {
        'Authorization': `Bearer ${hfApiKey}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'true',
        'x-use-cache': 'false'
      },
      body: JSON.stringify({ 
        inputs: prompt,
        parameters: {
          num_inference_steps: 28
        }
      })
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Erro desconhecido');
      console.error(`[generate-image] HF API ${response.status}:`, errText);
      return new Response(
        JSON.stringify({ error: 'A inteligência artificial de imagens está indisponível no momento.', details: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extrai o buffer binário da imagem
    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const ext = mimeType.includes('png') ? 'png' : 'jpg';

    // Upload pro Supabase Storage
    const fileName = `ai-generated/${userId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('[generate-image] Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar imagem gerada.', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
    console.log(`[generate-image] Success! URL: ${urlData.publicUrl.slice(0, 80)}...`)

    // Atualiza a cota após sucesso de forma atômica
    const { error: rpcError } = await supabase.rpc('increment_ai_image_usage', { p_user_id: userId });
    if (rpcError) {
      console.error('Erro ao incrementar uso de imagem:', rpcError);
    }

    return new Response(
      JSON.stringify({ imageUrl: urlData.publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[generate-image] Fatal error:', message);
    return new Response(
      JSON.stringify({ error: 'Ocorreu um erro interno ao processar a imagem.', message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
