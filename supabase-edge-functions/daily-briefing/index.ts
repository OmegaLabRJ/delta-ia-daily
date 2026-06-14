import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const apiKey = Deno.env.get('GEMINI_API_KEY')

  const todayStr = new Date().toISOString().split('T')[0]

  // Busca TODOS os profissionais que possuem push token (ativos no app)
  const { data: professionals } = await supabase
    .from('profiles')
    .select('id, expo_push_token, display_name')
    .not('expo_push_token', 'is', null)

  if (!professionals || professionals.length === 0) {
    return new Response(JSON.stringify({ message: 'Nenhum profissional com token' }), { status: 200 })
  }

  // Busca agendamentos de hoje agrupados por profissional
  const { data: appointments } = await supabase
    .from('appointments')
    .select('appointment_time, service_id, marketplace_items!inner(seller_id)')
    .eq('appointment_date', todayStr)
    .in('status', ['confirmed', 'pending'])
    .order('appointment_time', { ascending: true })

  const apptsByProf: Record<string, any[]> = {}
  if (appointments) {
    for (const appt of appointments) {
      const sellerId = (appt.marketplace_items as any).seller_id
      if (!apptsByProf[sellerId]) apptsByProf[sellerId] = []
      apptsByProf[sellerId].push(appt)
    }
  }

  let sent = 0
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysStr = thirtyDaysAgo.toISOString();

  for (const prof of professionals) {
    try {
      const profAppts = apptsByProf[prof.id] || []
      const count = profAppts.length
      const firstTime = count > 0 ? profAppts[0].appointment_time?.slice(0, 5) : null

      // Busca meta de faturamento do mês atual na tabela revenue_goals
      const currentMonth = new Date();
      const monthYear = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
      
      const { data: goalData } = await supabase
        .from('revenue_goals')
        .select('monthly_target')
        .eq('professional_id', prof.id)
        .eq('month_year', monthYear)
        .maybeSingle()
      
      const monthlyTarget = goalData?.monthly_target || null;

      // Busca clientes inativos do profissional
      const { data: inactiveClients } = await supabase
        .from('client_profiles')
        .select('client_name')
        .eq('professional_id', prof.id)
        .lt('last_visit_date', thirtyDaysStr)
        .limit(3)

      const inactiveNames = inactiveClients?.map(c => c.client_name).join(', ') || 'Nenhum'

      // Chama o Gemini para redigir o insight diário pró-ativo
      const prompt = `Você é a Consultora Daily, uma assistente virtual de negócios proativa. 
Escreva um "Daily Briefing" curto e animado (máximo 2 parágrafos) para o profissional ${prof.display_name}.
DADOS DE HOJE:
- Agendamentos: ${count} ${count > 0 ? `(Primeiro começa às ${firstTime})` : ''}
- Meta Mensal: ${monthlyTarget ? `R$ ${monthlyTarget}` : 'Não definida'}
- Clientes Inativos (>30 dias): ${inactiveNames}

REGRAS ESTritas:
- Seja direta e use tom acolhedor com emojis.
- Se houver clientes inativos, sugira explicitamente uma ação (ex: "Que tal mandar uma mensagem de saudade para a Maria?").
- Se Clientes Inativos for 'Nenhum', não mencione clientes inativos — foque em agenda e/ou meta financeira.
- Vá direto ao ponto, não use saudações formais longas.`;

      let aiMessage = count === 1
        ? `Você tem 1 agendamento hoje às ${firstTime} 📅`
        : count > 1 
          ? `Você tem ${count} agendamentos hoje. Primeiro às ${firstTime} 📅` 
          : `Dia livre hoje! Que tal aproveitar para focar no marketing? 🚀`;

      if (apiKey) {
        try {
          const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 150 },
            })
          });
          const data = await res.json();
          if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            aiMessage = data.candidates[0].content.parts[0].text.trim();
          }
        } catch (e) {
          console.error(`Erro Gemini para ${prof.id}:`, e);
        }
      }

      // Dispara Push Notification via Expo
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: prof.expo_push_token,
          title: '☀️ Daily Briefing: Sua visão de hoje',
          body: aiMessage,
          sound: 'default',
          data: { screen: 'notifications' }
        })
      })

      // Salva no painel de notificações in-app
      await supabase.from('notifications').insert({
        user_id: prof.id,
        type: 'briefing',
        title: '☀️ Daily Briefing: Sua visão de hoje',
        body: aiMessage,
        target_type: 'agenda'
      })

      sent++
    } catch (error) {
      console.error(`Erro ao processar briefing para o profissional ${prof.id}:`, error)
    } finally {
      // Delay de 4s (throttling) para evitar rate limit
      await new Promise(r => setTimeout(r, 4000))
    }
  }

  return new Response(JSON.stringify({ sent }), { status: 200 })
})
