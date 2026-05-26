import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_NAME = "primo-fluency-hub";
const SENDER_DOMAIN = "notify.captcf.fr";
const FROM_DOMAIN = "captcf.fr";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? "";

    const body = await req.json();
    const { pdf_base64, session_titre, session_date, formateur_email } = body as {
      pdf_base64: string;
      session_titre: string;
      session_date: string;
      formateur_email?: string;
    };

    if (!pdf_base64 || !session_titre) {
      return new Response(JSON.stringify({ error: "pdf_base64 et session_titre requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Décoder le PDF et l'uploader dans le bucket
    const binary = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0));
    const path = `${userId}/bilan-${session_date}-${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("bilans-pdf")
      .upload(path, binary, { contentType: "application/pdf", upsert: false });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await supabase.storage
      .from("bilans-pdf")
      .createSignedUrl(path, 60 * 60 * 24 * 30); // 30 jours
    if (signErr || !signed) throw signErr ?? new Error("signed url failed");

    const recipient = (formateur_email && formateur_email.trim()) || userEmail;
    if (!recipient) {
      return new Response(JSON.stringify({ error: "Aucune adresse e-mail destinataire" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = `Bilan d'atelier — ${session_titre} — ${session_date}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:#0b234a;margin-top:0;">Bilan d'atelier</h2>
        <p>Bonjour,</p>
        <p>Vous trouverez ci-dessous le bilan PDF de votre atelier <strong>${session_titre}</strong> du <strong>${session_date}</strong>.</p>
        <p style="margin:24px 0;">
          <a href="${signed.signedUrl}" style="display:inline-block;background:#0b234a;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
            📄 Télécharger le PDF
          </a>
        </p>
        <p style="color:#666;font-size:13px;">Ce lien expire dans 30 jours.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#999;font-size:12px;">${SITE_NAME} · ${FROM_DOMAIN}</p>
      </div>`;
    const text = `Bilan d'atelier — ${session_titre} (${session_date})\n\nTélécharger : ${signed.signedUrl}\n\nCe lien expire dans 30 jours.`;

    const messageId = crypto.randomUUID();
    const { error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: recipient,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: "bilan_atelier_pdf",
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) throw enqueueError;

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: "bilan_atelier_pdf",
      recipient_email: recipient,
      status: "pending",
    });

    return new Response(JSON.stringify({ sent: true, recipient, url: signed.signedUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-bilan-email error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
