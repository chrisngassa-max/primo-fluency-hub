// @ts-nocheck
/**
 * Logique de correction d'exercice côté SERVEUR (Edge Function).
 * Réplique fidèle de src/lib/correctionExercice.ts mais sans dépendances client.
 *
 * Règle critique :
 * - QCM / V/F / lacunaire / appariement / transformation → comparaison normalisée
 * - Productions libres (EE / EO / production_*) ou items dont la "bonne_reponse"
 *   ressemble à un template/critère pédagogique → appel IA via tcf-evaluate-answer.
 *
 * Vague 2 : aucun calcul de score ne doit plus être fait côté client. Cette
 * fonction est l'autorité serveur.
 */

export interface ServerCorrectionItem {
  question: string;
  reponse_eleve: string;
  bonne_reponse: string;
  bonne_reponse_label?: "bonne_reponse" | "exemple_attendu";
  correct: boolean;
  explication: string;
  ia_evaluated?: boolean;
  ia_score_raw?: number;
  ai_failed?: boolean;
}

export interface ServerCorrigerOptions {
  format?: string;
  competence?: string;
  items: Array<Record<string, unknown>>;
  answers: Record<string | number, unknown>;
  metadata?: { code?: string };
  /** URL du projet Supabase (pour appeler tcf-evaluate-answer en interne). */
  supabaseUrl: string;
  /** Service role key — utilisée pour autoriser l'appel function-to-function. */
  serviceRoleKey: string;
}

export interface ServerCorrigerResult {
  correction: ServerCorrectionItem[];
  score: number;
  countedItems: number;
  correctCount: number;
  /** True si au moins un item a échoué l'évaluation IA → score partiel. */
  ai_failed: boolean;
}

const AI_FORMATS = new Set([
  "production_ecrite",
  "production_orale",
  "expression_ecrite",
  "expression_orale",
  "redaction",
  "redaction_libre",
]);

function normalize(s: unknown): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;:!?'"()«»\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function needsAIEvaluation(format?: string, competence?: string): boolean {
  if (!format && !competence) return false;
  if (format && AI_FORMATS.has(format)) return true;
  if (competence === "EE" || competence === "EO") return true;
  return false;
}

function looksLikeTemplate(s: string): boolean {
  if (!s) return false;
  if (/\[[^\]]+\]/.test(s)) return true;
  if (/^(le candidat|l['’]apprenant|l['’]élève|l['’]eleve)\s+(doit|devra)/i.test(s.trim())) return true;
  if (s.length > 120) return true;
  return false;
}

/**
 * Appelle tcf-evaluate-answer en interne (function-to-function).
 * Utilise le service role pour passer l'auth de l'edge function appelée.
 */
async function evaluateAI(
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: { studentAnswer: string; exerciseContent: string; rule: string }
): Promise<{ scoreRaw10: number; justification: string; resultat?: string; reformulation?: string }> {
  const url = `${supabaseUrl}/functions/v1/tcf-evaluate-answer`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`tcf-evaluate-answer ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  const rawScore = Number(data?.score ?? data?.score_estime ?? 0);
  const scoreRaw10 = Math.max(0, Math.min(10, Math.round(isFinite(rawScore) ? rawScore : 0)));
  return {
    scoreRaw10,
    justification: data?.justification ?? data?.correction_text ?? "Pas de justification disponible.",
    resultat: data?.resultat,
    reformulation: data?.reformulation_modele,
  };
}

export async function corrigerExerciceServer(
  opts: ServerCorrigerOptions
): Promise<ServerCorrigerResult> {
  const { items, answers, format, competence, metadata, supabaseUrl, serviceRoleKey } = opts;
  const useAI = needsAIEvaluation(format, competence);

  const correction: ServerCorrectionItem[] = [];
  let correctCount = 0;
  let countedItems = 0;
  let aiFailedAny = false;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx] as Record<string, unknown>;
    const userAnswer = (answers[idx] ?? answers[String(idx)] ?? "").toString();
    const question = (item.question || item.texte || item.enonce || item.consigne || `Question ${idx + 1}`) as string;
    const bonneReponse = (item.bonne_reponse ?? "").toString();
    const explicationOrig = (item.explication ?? "") as string;

    const hasOptions = Array.isArray((item as { options?: unknown }).options)
      && ((item as { options: unknown[] }).options).length > 0;
    const itemNeedsAI = useAI || (!hasOptions && looksLikeTemplate(bonneReponse));

    let isCorrect = false;
    let iaEvaluated = false;
    let iaScoreRaw: number | undefined;
    let aiFailedItem = false;
    let explication = explicationOrig;
    let displayedBonneReponse = bonneReponse;
    let label: "bonne_reponse" | "exemple_attendu" = "bonne_reponse";

    if (itemNeedsAI && userAnswer.trim() === "") {
      // Réponse vide → 0 immédiat, pas d'appel IA inutile
      isCorrect = false;
      label = "exemple_attendu";
      displayedBonneReponse = looksLikeTemplate(bonneReponse) ? "Réponse libre attendue." : bonneReponse;
    } else if (itemNeedsAI) {
      const exerciseContent = typeof item.criteres_evaluation === "object"
        ? JSON.stringify(item.criteres_evaluation)
        : String(item.criteres_evaluation ?? `${question}\n\nAttendu : ${bonneReponse || "réponse pertinente, claire, en français correct."}`);
      const rule = (format === "production_orale" || competence === "EO")
        ? "Évaluation orale FLE : prononciation, vocabulaire, grammaire, cohérence"
        : "Grammaire et compréhension FLE";

      try {
        const ai = await evaluateAI(supabaseUrl, serviceRoleKey, {
          studentAnswer: userAnswer,
          exerciseContent,
          rule,
        });
        iaEvaluated = true;
        iaScoreRaw = ai.scoreRaw10;
        isCorrect = (iaScoreRaw ?? 0) >= 6 && ai.resultat !== "incorrect";
        if (ai.justification) {
          explication = explication ? `${explication}\n\n${ai.justification}` : ai.justification;
        }
        label = "exemple_attendu";
        displayedBonneReponse = ai.reformulation?.trim()
          || (looksLikeTemplate(bonneReponse)
            ? "Il n'y a pas de réponse unique. Relis les critères dans l'explication ci-dessous."
            : bonneReponse);
      } catch (e) {
        // FALLBACK Vague 2 — IA indisponible : score partiel, item flaggé
        console.error(`[corrigerExerciceServer] AI failed item ${idx}:`, (e as Error).message);
        aiFailedItem = true;
        aiFailedAny = true;
        isCorrect = false;
        label = "exemple_attendu";
        displayedBonneReponse = looksLikeTemplate(bonneReponse)
          ? "Réponse libre — évaluation IA indisponible."
          : bonneReponse;
        explication = "Évaluation IA indisponible, à revoir par le formateur.";
      }
    } else {
      // QCM / objectif : comparaison normalisée
      isCorrect = normalize(userAnswer) === normalize(bonneReponse) && userAnswer !== "";
    }

    // Item IA en échec : on l'EXCLUT du compte → score partiel honnête sur QCM
    // (cf. décision B : ne pas bloquer le devoir mais ne pas non plus mentir
    // sur le score). Si TOUS les items sont IA et tous échouent, score = 0.
    if (!aiFailedItem) {
      if (isCorrect) correctCount++;
      countedItems++;
    }

    correction.push({
      question,
      reponse_eleve: userAnswer,
      bonne_reponse: displayedBonneReponse,
      bonne_reponse_label: label,
      correct: isCorrect,
      explication,
      ia_evaluated: iaEvaluated,
      ia_score_raw: iaScoreRaw,
      ai_failed: aiFailedItem || undefined,
    });
  }

  const score = countedItems > 0 ? Math.round((correctCount / countedItems) * 100) : 0;
  return { correction, score, countedItems, correctCount, ai_failed: aiFailedAny };
}
