import {
  corsHeaders,
  getErrorDetails,
  getSandboxClients,
  jsonResponse,
} from "../_shared/sandbox-edge.ts";
import type { NiveauSandbox } from "../_shared/sandbox.types.ts";

const LEVELS = ["A1", "A2", "B1", "B2"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { admin, user } = await getSandboxClients(req);
    const body = await req.json().catch(() => ({})) as {
      niveau?: NiveauSandbox;
      origin?: string;
    };
    const niveau = body.niveau;
    if (!niveau || !LEVELS.includes(niveau)) {
      return jsonResponse({ error: `Niveau invalide: ${String(niveau)}` }, 400);
    }

    const { data: session, error } = await admin
      .from("sandbox_sessions")
      .select("id, statut, eleve_emails")
      .eq("formateur_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!session) {
      return jsonResponse({ error: "Aucune sandbox. Cree-la depuis le panneau Sandbox avant de basculer." }, 409);
    }
    if (session.statut !== "active") {
      return jsonResponse({
        error: `Sandbox indisponible (statut: ${session.statut}). Relance la creation depuis le panneau Sandbox.`,
      }, 409);
    }
    const eleve = session.eleve_emails?.find((item: any) => item.niveau === niveau);
    if (!eleve) return jsonResponse({ error: `Eleve sandbox ${niveau} introuvable dans la session active.` }, 400);

    const linkPayload: Record<string, unknown> = {
      type: "magiclink",
      email: eleve.email,
    };

    const { data, error: linkError } = await admin.auth.admin.generateLink(linkPayload as any);
    if (linkError) {
      console.error("generateLink failed", linkError);
      throw linkError;
    }


    return jsonResponse({
      token_hash: data.properties.hashed_token,
      niveau,
      expires_in_seconds: 3600,
    });
  } catch (error) {
    const details = getErrorDetails(error);
    console.error("sandbox-invite failed", { message: details.message, code: details.code });
    return jsonResponse({ error: details.message }, details.status);
  }
});
