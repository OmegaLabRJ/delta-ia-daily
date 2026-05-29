import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const today = new Date().toISOString().split('T')[0]

  // Busca agendamentos de hoje agrupados por profissional
  const { data: appointments } = await supabase
    .from('appointments')
    .select('appointment_time, notes, service_id, marketplace_items!inner(name, seller_id)')
    .eq('appointment_date', today)
    .in('status', ['confirmed', 'pending'])
    .order('appointment_time', { ascending: true })

  if (!appointments || appointments.length === 0) {
    return new Response(JSON.stringify({ message: 'Nenhum agendamento hoje' }), { status: 200 })
  }

  const byProfessional: Record<string, any[]> = {}
  for (const appt of appointments) {
    const sellerId = (appt.marketplace_items as any).seller_id
    if (!byProfessional[sellerId]) byProfessional[sellerId] = []
    byProfessional[sellerId].push(appt)
  }

  let sent = 0

  for (const [professionalId, appts] of Object.entries(byProfessional)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('expo_push_token, display_name')
      .eq('id', professionalId)
      .single()

    if (!(profile as any)?.expo_push_token) continue

    const count = appts.length
    const firstTime = appts[0].appointment_time?.slice(0, 5)
    const body = count === 1
      ? `Você tem 1 agendamento hoje às ${firstTime} 📅`
      : `Você tem ${count} agendamentos hoje. Primeiro às ${firstTime} 📅`

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: (profile as any).expo_push_token,
        title: 'Bom dia! ☀️ Sua agenda de hoje',
        body,
        sound: 'default',
        data: { screen: 'notifications' }
      })
    })

    await supabase.from('notifications').insert({
      user_id: professionalId,
      type: 'briefing',
      title: 'Bom dia! ☀️ Sua agenda de hoje',
      body,
      target_type: 'agenda'
    })

    sent++
  }

  return new Response(JSON.stringify({ sent }), { status: 200 })
})
