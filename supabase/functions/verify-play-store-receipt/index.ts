import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

async function getGoogleAccessToken(serviceAccountJson: any) {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 3600
  
  const privateKey = await importPKCS8(serviceAccountJson.private_key, "RS256")
  
  const jwt = await new SignJWT({
    iss: serviceAccountJson.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(privateKey)

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(`Google Auth Error: ${data.error_description || data.error}`)
  return data.access_token
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { receipt, productId } = await req.json()
    // planId NÃO vem mais do cliente — derivado server-side do productId

    // Mapa canônico: produto da Play Store → plano interno
    // Atualizar aqui quando criar novos produtos na Play Console
    const PRODUCT_TO_PLAN: Record<string, string> = {
      'daily_pro_monthly':     'pro',
      'daily_creator_monthly': 'creator',
    }

    if (!receipt || !productId) {
      return new Response(JSON.stringify({ error: 'Missing receipt data' }), { status: 400, headers: corsHeaders })
    }

    const resolvedPlanId = PRODUCT_TO_PLAN[productId]
    if (!resolvedPlanId) {
      return new Response(
        JSON.stringify({ error: `Produto desconhecido: ${productId}. Contate o suporte.` }),
        { status: 400, headers: corsHeaders }
      )
    }

    const purchaseToken = receipt.purchaseToken || receipt.transactionId
    const packageName = receipt.packageName || 'com.omegalab.daily'
    
    let expiresAt: string | null = null
    const saJsonStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')

    if (!saJsonStr) {
      throw new Error("Configuração do servidor ausente: GOOGLE_SERVICE_ACCOUNT_JSON. Não é possível validar recibos.");
    }

    const saJson = JSON.parse(saJsonStr)
    const token = await getGoogleAccessToken(saJson)
    
    // Validação Real Google Play V2
    const playResponse = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${purchaseToken}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    
    if (!playResponse.ok) {
        const errData = await playResponse.json()
        throw new Error(`Recibo inválido na Play Store: ${JSON.stringify(errData)}`)
    }
    
    const playData = await playResponse.json()
    const subscriptionState = playData.subscriptionState
    
    if (subscriptionState !== 'SUBSCRIPTION_STATE_ACTIVE' && subscriptionState !== 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') {
        return new Response(JSON.stringify({ error: `Assinatura inativa no Google (Status: ${subscriptionState})` }), { status: 400, headers: corsHeaders })
    }
    
    if (playData.lineItems && playData.lineItems.length > 0 && playData.lineItems[0].expiryTime) {
        expiresAt = playData.lineItems[0].expiryTime // Formato RFC3339 já entregue pela v2
    }

    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Atualizar tabela
    const { error } = await adminSupabase
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        plan_id: resolvedPlanId,   // ← server-side, nunca do client
        status: 'active',
        payment_provider: 'google_play',
        external_subscription_id: purchaseToken,
        started_at: new Date().toISOString(),
        expires_at: expiresAt
      }, { onConflict: 'user_id' })

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
