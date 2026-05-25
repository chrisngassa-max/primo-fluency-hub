// @ts-nocheck
/**
 * classifyAndEmitErrors — Sprint 3
 *
 * Appelle Claude pour classer chaque item incorrect dans la taxonomie
 * des 11 types d'erreur, puis insère les événements session_live_events
 * correspondants (reponse_correcte / reponse_incorrecte avec type_erreur_id).
 *
 * Conçu pour être appelé en fire-and-forget depuis submit-devoir-result
 * (et plus tard depuis auto-correct-exercise). Les erreurs sont loguées
 * mais ne font jamais échouer la réponse principale.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TAXONOMIE_COURTE = `
LEX_CONFUSION    — Faux ami, paronyme, mot dans le mauvais contexte (CO, CE, EE)
CONSIGNE_NC      — La réponse ne respecte pas la tâche demandée (toutes compétences)
GRAM_ACCORD      — Accord sujet-verbe ou nom-adjectif incorrect (EE)
GRAM_TEMPS       — Temps verbal inadéquat (EE, EO)
HORS_SUJET       — La production ne répond pas à la situation (EE, EO)
INTERPRETATION   — Contresens sur un document écrit ou audio (CE, CO)
JUSTIFICATION    — Absence d'arguments ou justification insuffisante (EE, EO)
PHONO            — Erreur de son qui gêne la compréhension (EO)
PRODUCTION_COURTE — Nombre de mots ou durée insuffisants (EE, EO)
REGISTRE         — Tutoiement au lieu du vouvoiement, ton inadapté (EE, EO)
COHERENCE_ADMIN  — Incohérence formulaire (ex: date dans champ téléphone)
`.trim();

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

export async function classifyAndEmitErrors(opts: ClassifyOpts): Promise<void> {
  const {
    sessionId, eleveId, exerciceId, competence, consigne,
    items, answers, correction, score,
    supabaseUrl, serviceRoleKey,
  } = opts;

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  // Identifier les items incorrects depuis correction_detaillee
  const corrArr = Array.isArray(correction) ? correction : [];
  const incorrect: Array<{ idx: number; question: string; reponse: string; bonne: string }> = [];

  corrArr.forEach((c: any, idx: number) => {
    if (!c.correct) {
      incorrect.push({
        idx,
        question:  c.question         ?? items[idx]?.question ?? `Item ${idx + 1}`,
        reponse:   c.reponse_donnee   ?? String((answers as any)[idx] ?? ""),
        bonne:     c.bonne_reponse    ?? String(items[idx]?.bonne_reponse ?? ""),
      });
    }
  });

  // ── Classification ──────────────────────────────────────────────────────────
  const classifications: Map<number, string> = new Map();

  if (anthropicKey && incorrect.length > 0) {
    const errorsJson = JSON.stringify(
      incorrect.map((e) => ({
        idx: e.idx,
        question: e.question,
        reponse_eleve: e.reponse,
        bonne_reponse: e.bonne,
      }))
    );

    const prompt = `Tu es correcteur pédagogique FLE (TCF IRN).
Compétence : ${competence}. Consigne : ${consigne}.

Erreurs à classer :
${errorsJson}

Types disponibles :
${TAXONOMIE_COURTE}

Réponds UNIQUEMENT en JSON strict, sans texte autour :
[{"idx": 0, "type_erreur_id": "LEX_CONFUSION"}, ...]

Si tu es incertain, utilise CONSIGNE_NC.`;

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
        const data = await res.json();
        const raw = data?.content?.[0]?.text ?? "";
        // Extraire le tableau JSON même si Claude ajoute du texte autour
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
    }
  }

  // ── Émission des événements live ────────────────────────────────────────────
  const eventsToInsert: Record<string, unknown>[] = [];

  // Un événement par item incorrect
  for (const err of incorrect) {
    eventsToInsert.push({
      session_id:    sessionId,
      eleve_id:      eleveId,
      event_type:    "reponse_incorrecte",
      type_erreur_id: classifications.get(err.idx) ?? null,
      payload: {
        exercice_id: exerciceId,
        competence,
        item_idx:    err.idx,
        question:    err.question,
        reponse:     err.reponse,
      },
    });
  }

  // Un événement pour les items corrects (agrégé, pas par item)
  const correctCount = corrArr.filter((c: any) => c.correct).length;
  if (correctCount > 0) {
    eventsToInsert.push({
      session_id: sessionId,
      eleve_id:   eleveId,
      event_type: "reponse_correcte",
      payload: {
        exercice_id:   exerciceId,
        competence,
        correct_count: correctCount,
        score,
      },
    });
  }

  if (eventsToInsert.length > 0) {
    const { error } = await admin.from("session_live_events").insert(eventsToInsert);
    if (error) {
      console.warn("[classifyAndEmitErrors] insert events failed:", error.message);
    }
  }
}
