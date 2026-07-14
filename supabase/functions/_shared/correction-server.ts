// @ts-nocheck
import { isStructuredAnswer } from "./justification-guard.ts";
import { computeOverallStatus, evaluateJustification, isScoreProvisional } from "./justification-evaluator.ts";

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
  criteres_oraux?: Record<string, { score: number; commentaire: string }>;
  ai_failed?: boolean;
  /**
   * Justification écrite par l'apprenant quand l'item porte
   * `justification_prompt` (Lot 2, B1/B2). Jamais utilisée pour le calcul de
   * `correct` (qui reste sur la seule `reponse_eleve`) — seulement conservée
   * pour la revue/correction ultérieure (formateur ou IA), conformément à la
   * doctrine "correction différée/qualitative" à ces niveaux.
   */
  learner_justification?: string;

  // --- Lot 2.1, point 5 : modèle de résultat qui distingue réellement la
  // correction du choix fermé de l'évaluation de la justification ouverte.
  // Un garde-fou "texte non vide" ne constitue pas une notation.
  /** Alias explicite de `correct`, nommé sans ambiguïté pour les nouveaux consommateurs. */
  answer_correct: boolean;
  justification_status: "not_required" | "missing" | "unrelated" | "restates_answer_without_evidence" | "accepted" | "pending_review";
  justification_score: number | null;
  justification_feedback: string;
  /** "incorrect" | "partial" | "provisional" | "complete" — jamais "complete" sur une bonne option sans justification acceptée quand elle est requise. */
  overall_status: "incorrect" | "partial" | "provisional" | "complete";
  /** true tant que la justification qualitative n'a pas reçu de verdict définitif (pending_review). */
  score_provisional: boolean;

  // --- Lot 2.1, point 6 : corrections générées par generate-s01-interactive.mjs
  // (item.correction), consommées ici en toute sécurité — jamais lues par le
  // client avant que get-attempt-correction ne les filtre après libération
  // (released-correction-filter.ts).
  preuve_support?: string | null;
  explication_distracteurs?: string[];
  erreur_diagnostiquee?: string | null;
  remediation?: string | null;
  justification_ouverte?: { elements_attendus: string[]; criteres_evaluation: string[] } | null;
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
  /** true si au moins un item reste overall_status="provisional" (justification en attente de revue humaine) : le score global n'est pas définitif. */
  score_provisional: boolean;
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
  payload: { studentAnswer: string; exerciseContent: string; rule: string; epreuve?: string }
): Promise<{
  scoreRaw10: number;
  justification: string;
  resultat?: string;
  reformulation?: string;
  criteresOraux?: Record<string, { score: number; commentaire: string }>;
}> {
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
    criteresOraux: data?.criteres_oraux,
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
  let anyScoreProvisional = false;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx] as Record<string, unknown>;
    const rawAnswer = answers[idx] ?? answers[String(idx)] ?? "";
    // Réponse structurée { reponse, justification } (Lot 2, items portant
    // justification_prompt) vs chaîne simple (tous les autres formats,
    // comportement historique inchangé). Seule `reponse` entre dans la
    // comparaison/l'évaluation ; `justification` est conservée à part.
    // NB : un `correct`/`score` éventuellement injecté par un client
    // malveillant dans l'objet `rawAnswer` est ignoré ici — seules les clés
    // `reponse`/`justification` sont jamais lues, `correct` est toujours
    // recalculé plus bas à partir de item.bonne_reponse.
    const structuredAnswer = isStructuredAnswer(rawAnswer);
    const userAnswer = (structuredAnswer ? (rawAnswer as Record<string, unknown>).reponse ?? "" : rawAnswer).toString();
    const learnerJustification = structuredAnswer
      ? (String((rawAnswer as Record<string, unknown>).justification ?? "").trim() || undefined)
      : undefined;
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
    let criteresOraux: Record<string, { score: number; commentaire: string }> | undefined;
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
          epreuve: competence,
        });
        iaEvaluated = true;
        iaScoreRaw = ai.scoreRaw10;
        criteresOraux = ai.criteresOraux;
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

    // Lot 2.1, point 5 : le choix fermé (isCorrect) est noté immédiatement,
    // mais une justification requise (justification_prompt) et non acceptée
    // empêche une réussite B1/B2 COMPLÈTE — jamais un simple "texte non
    // vide". Seuls les items non-IA avec justification_prompt sont évalués
    // ici : les formats IA (production_ecrite/EE/EO) gardent leur pipeline
    // existant, inchangé (justification_status="not_required").
    const justificationPromptPresent = !itemNeedsAI && Boolean((item as { justification_prompt?: unknown }).justification_prompt);
    const justificationEval = justificationPromptPresent
      ? evaluateJustification({
        justificationText: learnerJustification,
        elementsAttendus: ((item as { correction?: { justification_ouverte?: { elements_attendus?: unknown } } }).correction
          ?.justification_ouverte?.elements_attendus as string[] | undefined) ?? (explicationOrig ? [explicationOrig] : []),
        bonneReponse,
        justificationType: (item as { justification_type?: string }).justification_type ?? null,
      })
      : { justification_status: "not_required" as const, justification_score: null, justification_feedback: "" };
    const overallStatus = computeOverallStatus(isCorrect, justificationEval.justification_status);
    const scoreProvisionalItem = isScoreProvisional(overallStatus);

    // Item IA en échec : on l'EXCLUT du compte → score partiel honnête sur QCM
    // (cf. décision B : ne pas bloquer le devoir mais ne pas non plus mentir
    // sur le score). Si TOUS les items sont IA et tous échouent, score = 0.
    // Le compte de réussite se fonde sur overall_status="complete", pas sur
    // isCorrect seul : une bonne option avec justification insuffisante ne
    // compte plus comme une réussite (Lot 2.1, point 5).
    if (!aiFailedItem) {
      if (overallStatus === "complete") correctCount++;
      countedItems++;
    }
    if (scoreProvisionalItem) anyScoreProvisional = true;

    correction.push({
      question,
      reponse_eleve: userAnswer,
      bonne_reponse: displayedBonneReponse,
      bonne_reponse_label: label,
      answer_correct: isCorrect,
      justification_status: justificationEval.justification_status,
      justification_score: justificationEval.justification_score,
      justification_feedback: justificationEval.justification_feedback,
      overall_status: overallStatus,
      score_provisional: scoreProvisionalItem,
      correct: isCorrect,
      explication,
      ia_evaluated: iaEvaluated,
      ia_score_raw: iaScoreRaw,
      criteres_oraux: criteresOraux,
      ai_failed: aiFailedItem || undefined,
      learner_justification: learnerJustification,
      // Lot 2.1, point 6 : consommées depuis item.correction (généré par
      // generate-s01-interactive.mjs), jamais recalculées ni inventées ici.
      preuve_support: (item as { correction?: { preuve_support?: string | null } }).correction?.preuve_support ?? null,
      explication_distracteurs: (item as { correction?: { explication_distracteurs?: string[] } }).correction?.explication_distracteurs ?? [],
      erreur_diagnostiquee: (item as { correction?: { erreur_diagnostiquee?: string | null } }).correction?.erreur_diagnostiquee ?? null,
      remediation: (item as { correction?: { remediation?: string | null } }).correction?.remediation ?? null,
      justification_ouverte: (item as { correction?: { justification_ouverte?: { elements_attendus?: string[]; criteres_evaluation?: string[] } } }).correction?.justification_ouverte
        ? {
          elements_attendus: (item as { correction: { justification_ouverte: { elements_attendus?: string[] } } }).correction.justification_ouverte.elements_attendus ?? [],
          criteres_evaluation: (item as { correction: { justification_ouverte: { criteres_evaluation?: string[] } } }).correction.justification_ouverte.criteres_evaluation ?? [],
        }
        : null,
    });
  }

  const score = countedItems > 0 ? Math.round((correctCount / countedItems) * 100) : 0;
  return { correction, score, countedItems, correctCount, ai_failed: aiFailedAny, score_provisional: anyScoreProvisional };
}
