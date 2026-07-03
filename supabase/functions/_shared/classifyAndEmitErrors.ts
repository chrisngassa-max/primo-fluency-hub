// @ts-nocheck
/**
 * classifyAndEmitErrors — Sprint 3
 *
 * Appelle Claude pour classer chaque item incorrect dans la taxonomie
 * des 16 types d'erreur, puis insère les événements session_live_events
 * correspondants (reponse_correcte / reponse_incorrecte avec type_erreur_id).
 *
 * Conçu pour être appelé en fire-and-forget depuis submit-devoir-result
 * (et plus tard depuis auto-correct-exercise). Les erreurs sont loguées
 * mais ne font jamais échouer la réponse principale.
 *
 * RGPD : consentement élève obligatoire avant appel Claude ; productions EE/EO
 * pseudonymisées (niveau B) car elles peuvent contenir des données personnelles
 * ou administratives (adresse, date de naissance, etc.).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkConsent, logAICall } from "./check-consent.ts";
import { hasPseudonymSecret, pseudonymizeProductionText } from "./pseudonymize.ts";
import { buildLiveEventsToInsert } from "./classifyAndEmitEventsBuilder.ts";
import { TAXONOMIE_COURTE } from "./taxonomieCourte.ts";

const FUNCTION_NAME = "classifyAndEmitErrors";

export interface ClassifyOpts {
  sessionId: string;
  eleveId: string;
  exerciceId: string;
  competence: string;
  consigne: string;
  items: Array<{ question?: string; bonne_reponse?: string; [k: string]: unknown }>;
  answers: Record<string, unknown>;
  correction: unknown[];
  score: number;
  supabaseUrl: string;
  serviceRoleKey: string;
}

function isProductionCompetence(competence: string): boolean {
  const c = competence.toUpperCase();
  return c === "EE" || c === "EO";
}

export async function classifyAndEmitErrors(opts: ClassifyOpts): Promise<void> {
  const {
    sessionId, eleveId, exerciceId, competence, consigne,
    items, answers, correction, score,
    supabaseUrl, serviceRoleKey,
  } = opts;

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const needsPseudonym = isProductionCompetence(competence);

  const corrArr = Array.isArray(correction) ? correction : [];
  const incorrect: Array<{ idx: number; question: string; reponse: string; bonne: string }> = [];

  corrArr.forEach((c: any, idx: number) => {
    if (!c.correct) {
      incorrect.push({
        idx,
        question: c.question ?? items[idx]?.question ?? `Item ${idx + 1}`,
        reponse: c.reponse_donnee ?? String((answers as any)[idx] ?? ""),
        bonne: c.bonne_reponse ?? String(items[idx]?.bonne_reponse ?? ""),
      });
    }
  });

  const consent = await checkConsent({ userId: eleveId });
  let aiAllowed = consent.ok;

  if (!consent.ok) {
    await logAICall({
      function_name: FUNCTION_NAME,
      subject_user_id: eleveId,
      triggered_by_user_id: eleveId,
      status: "blocked_no_consent",
      data_categories: needsPseudonym ? ["production", "results"] : ["results"],
      pseudonymization_level: needsPseudonym ? "level_b" : "none",
    });
  } else if (needsPseudonym && !hasPseudonymSecret()) {
    aiAllowed = false;
    await logAICall({
      function_name: FUNCTION_NAME,
      subject_user_id: eleveId,
      triggered_by_user_id: eleveId,
      status: "error_missing_pseudonym_secret",
      data_categories: ["production", "results"],
      pseudonymization_level: "none",
      consent_version: consent.consentVersion,
    });
  }

  const classifications: Map<number, string> = new Map();

  if (anthropicKey && incorrect.length > 0 && aiAllowed) {
    let knownNames: string[] = [];
    if (needsPseudonym) {
      try {
        const { data: prof } = await admin
          .from("profiles")
          .select("nom, prenom, email")
          .eq("id", eleveId)
          .maybeSingle();
        if (prof) knownNames = [prof.prenom, prof.nom, prof.email].filter(Boolean) as string[];
      } catch {
        /* best-effort */
      }
    }

    const errorsForAi = await Promise.all(
      incorrect.map(async (e) => {
        let reponse_eleve = e.reponse;
        if (needsPseudonym) {
          try {
            reponse_eleve = await pseudonymizeProductionText(e.reponse, knownNames);
          } catch {
            reponse_eleve = "[contenu_non_transmis]";
          }
        }
        return {
          idx: e.idx,
          question: e.question,
          reponse_eleve,
          bonne_reponse: e.bonne,
        };
      }),
    );

    const errorsJson = JSON.stringify(errorsForAi);

    const prompt = `Tu es correcteur pédagogique FLE (TCF IRN).
Compétence : ${competence}. Consigne : ${consigne}.

Erreurs à classer :
${errorsJson}

Types disponibles :
${TAXONOMIE_COURTE}

Réponds UNIQUEMENT en JSON strict, sans texte autour :
[{"idx": 0, "type_erreur_id": "LEX_CONFUSION"}, ...]

Si tu es incertain, utilise CONSIGNE_NC.`;

    const started = Date.now();
    let logStatus: "ok" | "error" = "error";

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 256,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (res.ok) {
        logStatus = "ok";
        const data = await res.json();
        const raw = data?.content?.[0]?.text ?? "";
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed: Array<{ idx: number; type_erreur_id: string }> = JSON.parse(match[0]);
          for (const entry of parsed) {
            classifications.set(entry.idx, entry.type_erreur_id);
          }
        }
      }
    } catch (e) {
      console.warn("[classifyAndEmitErrors] Claude call failed:", (e as Error).message);
    } finally {
      await logAICall({
        function_name: FUNCTION_NAME,
        subject_user_id: eleveId,
        triggered_by_user_id: eleveId,
        status: logStatus,
        data_categories: needsPseudonym ? ["production", "results"] : ["results"],
        pseudonymization_level: needsPseudonym ? "level_b" : "none",
        consent_version: consent.consentVersion,
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        duration_ms: Date.now() - started,
      });
    }
  }

  const correctCount = corrArr.filter((c: any) => c.correct).length;
  const eventsToInsert = buildLiveEventsToInsert({
    sessionId,
    eleveId,
    exerciceId,
    competence,
    score,
    incorrect,
    classifications,
    correctCount,
  });

  if (eventsToInsert.length > 0) {
    const { error } = await admin.from("session_live_events").insert(eventsToInsert);
    if (error) {
      console.warn("[classifyAndEmitErrors] insert events failed:", error.message);
    }
  }
}
