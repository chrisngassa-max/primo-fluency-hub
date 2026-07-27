/**
 * Lot 2.1, point 5 — évaluation RÉELLE d'une justification ouverte (B1/B2).
 * Module PUR (pas d'import Deno/esm.sh), testable sous Vitest/Node.
 *
 * Un simple garde-fou "texte non vide" ne constitue pas une notation : ce
 * module distingue une justification correctement fondée sur le support
 * (citation ou reformulation), une justification manifestement sans
 * rapport, une simple répétition de la réponse sans preuve, et un cas
 * ambigu renvoyé en revue humaine (`pending_review`) plutôt que noté à
 * l'aveugle.
 *
 * Volontairement DÉTERMINISTE (recouvrement lexical avec les éléments
 * attendus réels, jamais un appel IA ici) : le système ne doit jamais
 * inventer une validation factuelle. Une réponse ambiguë reste
 * `pending_review`, jamais auto-validée par la seule présence de texte.
 */

export type JustificationStatus =
  | "not_required"
  | "missing"
  | "unrelated"
  | "restates_answer_without_evidence"
  | "accepted"
  | "pending_review";

export type OverallStatus = "incorrect" | "partial" | "provisional" | "complete";

export interface JustificationEvaluation {
  justification_status: JustificationStatus;
  justification_score: number | null;
  justification_feedback: string;
}

const STOPWORDS = new Set([
  "le", "la", "les", "l", "un", "une", "des", "de", "du", "d", "et", "ou", "que", "qui", "quoi",
  "est", "sont", "ce", "cet", "cette", "ces", "dans", "pour", "sur", "par", "avec", "sans", "a",
  "au", "aux", "en", "il", "elle", "ils", "elles", "vous", "votre", "vos", "son", "sa", "ses",
  "je", "tu", "nous", "on", "c", "n", "pas", "plus", "comme", "car", "donc", "mais", "si",
]);

function contentWords(text: string): string[] {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[«»"'.,;:!?()]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function overlapRatio(wordsA: Set<string>, wordsB: Set<string>): number {
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let matches = 0;
  for (const word of wordsB) if (wordsA.has(word)) matches += 1;
  return matches / wordsB.size;
}

function isSubsetOf(smaller: Set<string>, larger: Set<string>): boolean {
  if (smaller.size === 0) return false;
  for (const word of smaller) if (!larger.has(word)) return false;
  return true;
}

const ACCEPT_THRESHOLD = 0.34; // au moins ~1/3 des mots pleins attendus retrouvés (citation ou reformulation)
const PENDING_THRESHOLD = 0.01; // au-delà de 0, en-dessous du seuil d'acceptation -> ambigu, pas tranché seul

export interface EvaluateJustificationInput {
  justificationText: string | undefined;
  elementsAttendus: string[];
  bonneReponse: string;
  /** "nuance" exige une analyse relationnelle qu'un recouvrement lexical ne
   * peut pas valider seul : toujours renvoyé en pending_review sauf vide ou
   * manifestement sans rapport — jamais auto-accepté. */
  justificationType?: string | null;
}

export function evaluateJustification({
  justificationText,
  elementsAttendus,
  bonneReponse,
  justificationType,
}: EvaluateJustificationInput): JustificationEvaluation {
  const trimmed = String(justificationText ?? "").trim();

  if (trimmed.length === 0) {
    return { justification_status: "missing", justification_score: 0, justification_feedback: "Aucune justification saisie." };
  }

  const justWords = new Set(contentWords(trimmed));
  const answerWords = new Set(contentWords(bonneReponse));

  // Contribue-t-elle un mot au-delà de ce que dit déjà la réponse choisie ?
  // Un item d'un support d'observation cite souvent l'answer littéralement
  // (ex. "Awa Diallo" apparaît dans la preuve elle-même) : sans cette
  // vérification en premier, répéter la réponse serait à tort compté comme
  // une preuve, puisque ces mêmes mots figurent aussi dans elementsAttendus.
  if (isSubsetOf(justWords, answerWords)) {
    return {
      justification_status: "restates_answer_without_evidence",
      justification_score: 0,
      justification_feedback: "La justification répète la réponse choisie sans citer ni reformuler le support.",
    };
  }

  const elementsWords = new Set(elementsAttendus.flatMap((text) => contentWords(text)));
  const evidenceWords = new Set([...elementsWords].filter((word) => !answerWords.has(word)));
  const referenceWords = evidenceWords.size > 0 ? evidenceWords : elementsWords;
  const ratio = overlapRatio(justWords, referenceWords);

  if (ratio === 0) {
    return {
      justification_status: "unrelated",
      justification_score: 0,
      justification_feedback: "La justification ne présente aucun lien identifiable avec les éléments attendus du support.",
    };
  }

  const requiresQualitativeReview = justificationType === "nuance";

  if (!requiresQualitativeReview && ratio >= ACCEPT_THRESHOLD) {
    return {
      justification_status: "accepted",
      justification_score: Math.round(Math.min(ratio, 1) * 100),
      justification_feedback: "Justification acceptée : elle cite ou reformule les éléments attendus du support.",
    };
  }

  if (ratio >= PENDING_THRESHOLD) {
    return {
      justification_status: "pending_review",
      justification_score: null,
      justification_feedback: requiresQualitativeReview
        ? "Justification à revoir : une distinction/nuance demande une évaluation qualitative humaine, pas seulement un recouvrement lexical."
        : "Lien partiel avec le support détecté, insuffisant pour une acceptation automatique : à revoir par le formateur.",
    };
  }

  return {
    justification_status: "unrelated",
    justification_score: 0,
    justification_feedback: "La justification ne présente aucun lien identifiable avec les éléments attendus du support.",
  };
}

export function computeOverallStatus(answerCorrect: boolean, justificationStatus: JustificationStatus): OverallStatus {
  if (!answerCorrect) return "incorrect";
  if (justificationStatus === "not_required" || justificationStatus === "accepted") return "complete";
  if (justificationStatus === "pending_review") return "provisional";
  // missing / unrelated / restates_answer_without_evidence : bonne option
  // mais justification insuffisante -> jamais une réussite B1/B2 complète.
  return "partial";
}

export function isScoreProvisional(overallStatus: OverallStatus): boolean {
  return overallStatus === "provisional";
}
