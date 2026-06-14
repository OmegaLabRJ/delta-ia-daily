import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const fiveDaysAgo = new Date()
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

  // Busca profissionais ativos
  const { data: professionals, error: fetchError } = await supabase
    .from('profiles')
    .select('id, display_name, expo_push_token, specialty')
    .in('profile_type', ['professional', 'store'])
    .not('expo_push_token', 'is', null)

  if (fetchError) {
    console.error("Erro ao buscar profissionais:", fetchError);
    return new Response(JSON.stringify({ error: "Erro ao acessar banco de dados" }), { status: 500 })
  }

  if (!professionals || professionals.length === 0) {
    return new Response(JSON.stringify({ message: 'Nenhum profissional com push token' }), { status: 200 })
  }

  let sent = 0

  for (const pro of professionals) {
    try {
      // Verifica último post real
      const { data: lastPost, error: postError } = await supabase
        .from('posts')
        .select('created_at')
        .eq('user_id', (pro as any).id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (postError) {
        console.error(`Erro ao buscar posts do profissional ${pro.id}:`, postError);
        continue;
      }

      const lastPostDate = lastPost ? new Date((lastPost as any).created_at) : null
      const daysSincePost = lastPostDate
        ? Math.floor((Date.now() - lastPostDate.getTime()) / 86400000)
        : 999

      if (daysSincePost < 5) continue

      const alertTitle = `📸 Faz ${daysSincePost > 30 ? '30+' : daysSincePost} dias sem post!`;
      const alertBody = 'Profissionais que postam 3x/semana atraem muito mais clientes. Quer que a IA crie um post pra você?';

      // 1. Envia Push Notification
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: (pro as any).expo_push_token,
          title: alertTitle,
          body: alertBody,
          sound: 'default',
          data: { screen: 'ai-chat' }
        })
      })

      // 2. Grava no banco para exibir na aba de notificações do App
      const { error: insertError } = await supabase.from('notifications').insert({
        user_id: pro.id,
        type: 'alert',
        title: alertTitle,
        body: alertBody,
        target_type: 'profile'
      });

      if (insertError) {
        console.error(`Erro ao salvar notificação in-app para ${pro.id}:`, insertError);
      }

      sent++
    } catch (error) {
      console.error(`Erro inesperado ao processar alerta para ${pro.id}:`, error);
    } finally {
      // Throttling: Delay de 4s para evitar rate limit
      await new Promise(r => setTimeout(r, 4000));
    }
  }

  return new Response(JSON.stringify({ sent }), { status: 200 })
})
