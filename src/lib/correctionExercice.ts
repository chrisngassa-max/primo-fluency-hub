import { evaluerReponseIA } from "@/lib/testPositionnement";

/**
 * Correction d'un exercice côté élève.
 *
 * Règle CRITIQUE :
 * - QCM, V/F, texte_lacunaire, appariement, transformation → comparaison de chaîne
 *   normalisée (casse, accents, ponctuation, espaces).
 * - production_ecrite (EE) → évaluation IA via tcf-evaluate-answer, JAMAIS
 *   comparaison textuelle (le champ `bonne_reponse` contient un descriptif de
 *   critère pédagogique, pas une chaîne à matcher).
 * - production_orale (EO) → traité ailleurs (audio + STT + IA).
 */

export interface CorrectionItem {
  question: string;
  reponse_eleve: string;
  bonne_reponse: string;
  correct: boolean;
  explication: string;
  reported?: boolean;
  ia_evaluated?: boolean;
  ia_score_raw?: number; // 0-10
}

export interface CorrigerOptions {
  format?: string;
  competence?: string;
  /** Items déjà résolus (avec overrides éventuels). */
  items: Array<{
    question?: string;
    texte?: string;
    enonce?: string;
    consigne?: string;
    bonne_reponse?: string;
    explication?: string;
    criteres_evaluation?: unknown;
    mots_cles_attendus?: string[];
    [k: string]: unknown;
  }>;
  /** Réponses élève par index. */
  answers: Record<number | string, string>;
  /** Items signalés (exclus du score). */
  reportedItems?: Set<number>;
  /** Métadonnées globales de l'exercice (pour l'IA). */
  metadata?: { code?: string };
}

export interface CorrectionItemDisplay extends CorrectionItem {
  /** Libellé à utiliser devant `bonne_reponse` ("Bonne réponse" vs "Exemple de réponse attendue"). */
  bonne_reponse_label?: "bonne_reponse" | "exemple_attendu";
}

export interface CorrigerResult {
  correction: CorrectionItemDisplay[];
  /** Score 0-100 calculé sur les items NON signalés. */
  score: number;
  countedItems: number;
  correctCount: number;
}

/** Normalisation pour comparaison de chaînes (QCM, V/F, lacunaire, etc.). */
function normalize(s: string): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .toLowerCase()
    .replace(/[.,;:!?'"()«»\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PRODUCTION_ECRITE_FORMATS = new Set(["production_ecrite"]);

/** True si la correction de cet exercice nécessite une évaluation IA. */
export function needsAIEvaluation(format?: string, competence?: string): boolean {
  if (!format && !competence) return false;
  if (format && PRODUCTION_ECRITE_FORMATS.has(format)) return true;
  if (competence === "EE") return true;
  return false;
}

/**
 * Corrige un exercice complet. Async car peut appeler l'IA pour les EE.
 * Renvoie correction détaillée + score normalisé 0-100.
 */
export async function corrigerExercice(opts: CorrigerOptions): Promise<CorrigerResult> {
  const { items, answers, reportedItems = new Set<number>(), format, competence, metadata } = opts;

  const useAI = needsAIEvaluation(format, competence);

  const correction: CorrectionItemDisplay[] = [];
  let correctCount = 0;
  let countedItems = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const userAnswer = (answers[idx] ?? answers[String(idx)] ?? "").toString();
    const reported = reportedItems.has(idx);
    const question = (item.question || item.texte || item.enonce || item.consigne || `Question ${idx + 1}`) as string;
    const bonneReponse = (item.bonne_reponse ?? "").toString();

    let isCorrect = false;
    let iaEvaluated = false;
    let iaScoreRaw: number | undefined;
    let explication = (item.explication ?? "") as string;
    let displayedBonneReponse = bonneReponse;
    let bonneReponseLabel: "bonne_reponse" | "exemple_attendu" = "bonne_reponse";

    if (useAI) {
      // Évaluation IA pour la production écrite. JAMAIS de comparaison de chaîne.
      try {
        const evalResult = await evaluerReponseIA(
          {
            criteres_evaluation:
              item.criteres_evaluation ??
              bonneReponse ??
              "Production écrite : évaluer la pertinence, la grammaire et le lexique.",
          },
          userAnswer,
          {
            code: metadata?.code,
            type_reponse: "ecrit",
            mots_cles_attendus: item.mots_cles_attendus,
          }
        );
        iaEvaluated = true;
        iaScoreRaw = evalResult.scoreRaw10 ?? Math.round((evalResult.score / 3) * 10);
        // Seuil de validation IA : 6/10. En dessous = incorrect.
        // On respecte aussi `resultat` renvoyé par l'IA s'il dit "incorrect".
        isCorrect = (iaScoreRaw ?? 0) >= 6 && evalResult.resultat !== "incorrect";
        if (evalResult.justification) {
          explication = explication
            ? `${explication}\n\n${evalResult.justification}`
            : evalResult.justification;
        }
        // Production libre : on n'affiche JAMAIS la description du critère
        // pédagogique sous "Bonne réponse". On préfère la reformulation modèle
        // de l'IA, sinon un libellé neutre, et on change le label d'affichage.
        bonneReponseLabel = "exemple_attendu";
        displayedBonneReponse = evalResult.reformulationModele?.trim()
          || "Il n'y a pas de réponse unique. Relis les critères dans l'explication ci-dessous.";
      } catch (e) {
        console.error("[corrigerExercice] AI eval failed for item", idx, e);
        // En cas d'échec IA : on note non corrigé (faux) plutôt que de tricher.
        isCorrect = false;
        bonneReponseLabel = "exemple_attendu";
        displayedBonneReponse = "Évaluation IA indisponible — réessaie plus tard.";
      }
    } else {
      // Comparaison de chaîne normalisée pour QCM, V/F, lacunaire, transformation, appariement.
      isCorrect = normalize(userAnswer) === normalize(bonneReponse) && userAnswer !== "";
    }

    if (!reported) {
      if (isCorrect) correctCount++;
      countedItems++;
    }

    correction.push({
      question,
      reponse_eleve: userAnswer,
      bonne_reponse: displayedBonneReponse,
      bonne_reponse_label: bonneReponseLabel,
      correct: isCorrect,
      explication,
      reported,
      ia_evaluated: iaEvaluated,
      ia_score_raw: iaScoreRaw,
    });
  }

  const score = countedItems > 0 ? Math.round((correctCount / countedItems) * 100) : 0;
  return { correction, score, countedItems, correctCount };
}
