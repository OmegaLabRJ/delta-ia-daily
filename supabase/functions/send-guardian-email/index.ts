import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GUARDIAN_SECRET      = Deno.env.get("GUARDIAN_TOKEN_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Gera token HMAC seguro: base64(payload) + '.' + base64(assinatura) */
async function generateGuardianToken(userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(GUARDIAN_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const payload = `${userId}:${Date.now()}`;
  const sig     = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return btoa(payload) + "." + btoa(String.fromCharCode(...new Uint8Array(sig)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { guardianEmail, userId } = await req.json();

    if (!guardianEmail || !userId) {
      return new Response(JSON.stringify({ error: "Parâmetros incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gerar token HMAC e persistir no banco antes de enviar o email
    const token     = await generateGuardianToken(userId);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Invalidar tokens anteriores do mesmo usuário (evita múltiplos links ativos)
    await adminClient
      .from("guardian_tokens")
      .delete()
      .eq("user_id", userId)
      .is("used_at", null);

    const { error: insertError } = await adminClient.from("guardian_tokens").insert({
      user_id:    userId,
      token,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error("Erro ao salvar guardian token:", insertError);
      return new Response(JSON.stringify({ error: "Erro interno ao gerar link." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const approvalLink = `${SUPABASE_URL}/functions/v1/approve-guardian?token=${encodeURIComponent(token)}`;

    // Simular envio se RESEND_API_KEY não estiver configurada (ambiente de dev)
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY não configurada. Simulando envio de e-mail.");
      console.info("Approval link (dev):", approvalLink);
      return new Response(JSON.stringify({ success: true, simulated: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    "Daily App <no-reply@dailyapp.com.br>",
        to:      [guardianEmail],
        subject: "Autorização de Responsável Necessária - Daily App",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Autorização de Acesso</h2>
            <p>Olá,</p>
            <p>Um menor de idade indicou este e-mail como sendo do seu responsável legal para criar uma conta no aplicativo <strong>Daily</strong>.</p>
            <p>Para cumprir com a legislação de proteção de dados (ECA/LGPD Art. 14), precisamos da sua autorização para que a conta tenha o acesso liberado.</p>
            <br/>
            <a href="${approvalLink}" style="background-color: #FF9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Aprovar Acesso
            </a>
            <br/><br/>
            <p style="font-size: 13px; color: #666;">Este link expira em <strong>48 horas</strong> e só pode ser utilizado uma vez.</p>
            <p style="font-size: 13px; color: #666;">Se você não sabe do que se trata, basta ignorar este e-mail.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Erro na API do Resend:", err);
      return new Response(JSON.stringify({ error: "Erro ao enviar e-mail" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
