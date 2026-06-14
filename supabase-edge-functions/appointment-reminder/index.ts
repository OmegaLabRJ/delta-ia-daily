import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const todayStr = new Date().toISOString().split('T')[0]

  // Busca agendamentos do dia
  const { data: appointments, error: fetchError } = await supabase
    .from('appointments')
    .select('id, appointment_time, client_id, service_id, marketplace_items!inner(name, seller_id)')
    .eq('appointment_date', todayStr)
    .eq('status', 'confirmed')

  if (fetchError) {
    console.error("Erro ao buscar agendamentos:", fetchError);
    return new Response(JSON.stringify({ error: "Erro interno no banco de dados." }), { status: 500 })
  }

  if (!appointments || appointments.length === 0) {
    return new Response(JSON.stringify({ message: 'Nenhum agendamento confirmado hoje' }), { status: 200 })
  }

  let sent = 0

  for (const appt of appointments) {
    try {
      const serviceName = (appt.marketplace_items as any).name
      const time = appt.appointment_time?.slice(0, 5)
      const sellerId = (appt.marketplace_items as any).seller_id
      
      // Ignora se não houver client_id
      if (!appt.client_id) continue;

      // Fetch Push tokens for client and professional com error handling
      const [clientRes, sellerRes] = await Promise.all([
        supabase.from('profiles').select('expo_push_token, display_name').eq('id', appt.client_id).maybeSingle(),
        supabase.from('profiles').select('expo_push_token, display_name').eq('id', sellerId).maybeSingle()
      ])

      const client = clientRes.data
      const seller = sellerRes.data

      const pushMessages = []

      // 1. Notifica Consumidor (se não for o próprio lojista)
      if (client?.expo_push_token && appt.client_id !== sellerId) {
        const titleClient = '📅 Lembrete de agendamento';
        const bodyClient = `Olá! Hoje você tem "${serviceName}" agendado com ${seller?.display_name || 'a loja'} às ${time}. Até lá! 💅`;

        pushMessages.push({
          to: client.expo_push_token,
          title: titleClient,
          body: bodyClient,
          sound: 'default',
          data: { screen: 'notifications' }
        })

        // Grava in-app notification
        await supabase.from('notifications').insert({
          user_id: appt.client_id,
          type: 'reminder',
          title: titleClient,
          body: bodyClient,
          target_type: 'agenda'
        });
      }

      // 2. Notifica Lojista
      if (seller?.expo_push_token) {
        const titleSeller = '📅 Cliente Agendado Hoje';
        const bodySeller = `Olá! Hoje você tem um cliente (${client?.display_name || 'Cliente'}) agendado para "${serviceName}" às ${time}. Ótimo trabalho! 💼`;

        pushMessages.push({
          to: seller.expo_push_token,
          title: titleSeller,
          body: bodySeller,
          sound: 'default',
          data: { screen: 'notifications' }
        })

        // Grava in-app notification
        await supabase.from('notifications').insert({
          user_id: sellerId,
          type: 'reminder',
          title: titleSeller,
          body: bodySeller,
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
          body: JSON.stringify(pushMessages)
        })
        sent += pushMessages.length
      }

    } catch (error) {
       console.error(`Erro ao processar lembrete de agendamento ${appt.id}:`, error);
    } finally {
       // Throttling: Delay de 4s para evitar rate limit da API da Expo e do Banco
       await new Promise(r => setTimeout(r, 4000));
    }
  }

  return new Response(JSON.stringify({ sent }), { status: 200 })
})
