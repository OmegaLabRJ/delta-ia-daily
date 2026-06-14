import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Autenticação: apenas usuários logados podem disparar notificações
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { professional_id, consumer_id, consumer_name, service_name, date, time, consumer_phone } = await req.json()

    if (!professional_id) {
       return new Response(JSON.stringify({ error: 'professional_id é obrigatório.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 1. Buscar token de Push do profissional
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('expo_push_token, whatsapp, display_name')
      .eq('id', professional_id)
      .maybeSingle()

    if (profileError) {
      console.error("Erro ao buscar profile do profissional:", profileError);
    }

    // 2. Buscar token de Push do consumidor
    let consumerProfile = null
    if (consumer_id) {
      const { data, error: consumerError } = await supabase
        .from('profiles')
        .select('expo_push_token')
        .eq('id', consumer_id)
        .maybeSingle()
        
      if (consumerError) {
        console.error("Erro ao buscar profile do consumidor:", consumerError);
      }
      consumerProfile = data
    }

    // 3. Montar e enviar Notificações Push via Expo e Salvar In-App
    const pushMessages = []

    if (profile) {
      const titleSeller = 'Novo Agendamento! 🎉';
      const bodySeller = `${consumer_name} agendou ${service_name} no dia ${date} às ${time}.`;
      
      if (profile.expo_push_token) {
        pushMessages.push({
          to: profile.expo_push_token,
          sound: 'default',
          title: titleSeller,
          body: bodySeller,
          data: { screen: 'notifications' },
        })
      }

      // In-app Notification Lojista
      await supabase.from('notifications').insert({
        user_id: professional_id,
        type: 'booking',
        title: titleSeller,
        body: bodySeller,
        target_type: 'agenda'
      });
    }

    if (consumerProfile) {
      const titleClient = 'Agendamento Confirmado! ✅';
      const bodyClient = `Seu agendamento para ${service_name} com ${profile?.display_name || 'a loja'} no dia ${date} às ${time} está confirmado!`;
      
      if (consumerProfile.expo_push_token) {
        pushMessages.push({
          to: consumerProfile.expo_push_token,
          sound: 'default',
          title: titleClient,
          body: bodyClient,
          data: { screen: 'notifications' },
        })
      }

      // In-app Notification Consumidor
      await supabase.from('notifications').insert({
        user_id: consumer_id,
        type: 'booking',
        title: titleClient,
        body: bodyClient,
        target_type: 'agenda'
      });
    }

    if (pushMessages.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushMessages),
      })
    }

    // 4. (Futuro) Enviar Notificação de WhatsApp
    const whatsappProviderUrl = Deno.env.get('WHATSAPP_API_URL') 
    const whatsappToken = Deno.env.get('WHATSAPP_API_TOKEN')
    
    if (whatsappProviderUrl && whatsappToken && consumer_phone) {
      const textMessage = `Olá ${consumer_name}! Seu agendamento para ${service_name} com ${profile?.display_name || 'o profissional'} no dia ${date} às ${time} foi confirmado pela Assistente Daily.`
      
      console.log("Simulando disparo de WhatsApp para:", consumer_phone, textMessage)
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notificações processadas com sucesso" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("Erro na Edge Function notify-booking:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
