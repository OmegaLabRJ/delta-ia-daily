import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const htmlPage = (title: string, emoji: string, heading: string, body: string, color: string) => `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f9fafb; margin: 0; }
      .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
      h1 { color: ${color}; margin-bottom: 16px; }
      p { color: #4b5563; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <div style="font-size: 48px">${emoji}</div>
      <h1>${heading}</h1>
      <p>${body}</p>
      <p style="margin-top: 24px; font-size: 14px; color: #9ca3af;">Você pode fechar esta janela.</p>
    </div>
  </body>
  </html>
`;

serve(async (req) => {
  try {
    const url   = new URL(req.url);
    const token = url.searchParams.get("token");

    // 1. Token obrigatório
    if (!token) {
      return new Response(
        htmlPage("Link Inválido", "❌", "Link Inválido", "Este link de autorização está incompleto ou malformado.", "#ef4444"),
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // 2. Buscar token no banco
    const { data: tokenRecord, error: fetchError } = await adminClient
      .from("guardian_tokens")
      .select("user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (fetchError || !tokenRecord) {
      return new Response(
        htmlPage("Link Inválido", "❌", "Link Inválido", "Este link de autorização não é válido ou já foi removido.", "#ef4444"),
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // 3. Verificar se já foi usado (one-time use)
    if (tokenRecord.used_at) {
      return new Response(
        htmlPage("Link Já Utilizado", "⚠️", "Link Já Utilizado", "Este link de autorização já foi utilizado anteriormente. Cada link só pode ser usado uma vez.", "#f59e0b"),
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // 4. Verificar expiração (48h)
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return new Response(
        htmlPage("Link Expirado", "⏰", "Link Expirado", "Este link de autorização expirou. O prazo de 48 horas foi excedido. Peça ao menor para refazer o cadastro e enviar um novo link.", "#f59e0b"),
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // 5. Marcar como usado E aprovar — duas operações em sequência
    const { error: tokenUpdateError } = await adminClient
      .from("guardian_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token);

    if (tokenUpdateError) {
      console.error("Erro ao marcar token como usado:", tokenUpdateError);
      return new Response(
        htmlPage("Erro", "❌", "Erro ao processar", "Ocorreu um erro ao processar a autorização. Tente novamente.", "#ef4444"),
        { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const { error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({ guardian_consent: true })
      .eq("id", tokenRecord.user_id);

    if (profileUpdateError) {
      console.error("Erro ao atualizar guardian_consent:", profileUpdateError);
      return new Response(
        htmlPage("Erro", "❌", "Erro ao aprovar", "Ocorreu um erro ao liberar o acesso. Entre em contato com o suporte.", "#ef4444"),
        { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // 6. Sucesso
    return new Response(
      htmlPage("Acesso Aprovado", "✅", "Acesso Aprovado!", "Obrigado! A conta foi liberada com sucesso e agora pode ser utilizada de forma segura no aplicativo Daily.", "#4CAF50"),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );

  } catch (err: any) {
    return new Response(
      htmlPage("Erro Interno", "❌", "Erro Interno", `Ocorreu um erro inesperado: ${err.message}`, "#ef4444"),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
});
