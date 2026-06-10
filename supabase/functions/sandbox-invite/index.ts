import {
  corsHeaders,
  getSandboxClients,
  jsonResponse,
} from "../_shared/sandbox-edge.ts";
import type { NiveauSandbox } from "../_shared/sandbox.types.ts";

const LEVELS = ["A1", "A2", "B1", "B2"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { admin, user } = await getSandboxClients(req);
    const { niveau, redirect_to } = await req.json().catch(() => ({})) as {
      niveau?: NiveauSandbox;
      redirect_to?: string;
    };
    if (!niveau || !LEVELS.includes(niveau) || !redirect_to) {
      return jsonResponse({ error: "Niveau ou URL de redirection invalide" }, 400);
    }

    const redirect = new URL(redirect_to);
    if (!["http:", "https:"].includes(redirect.protocol)) {
      return jsonResponse({ error: "URL de redirection invalide" }, 400);
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

    const { data, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: eleve.email,
      options: { redirectTo: redirect.toString() },
    });
    if (linkError) throw linkError;

    return jsonResponse({
      invite_url: data.properties.action_link,
      niveau,
      expires_in_seconds: 3600,
    });
  } catch (error) {
    console.error("sandbox-invite failed", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ error: error instanceof Error ? error.message : "Erreur sandbox" }, (error as any)?.status ?? 500);
  }
});
