import type { PedagogicalIntent, PedagogicalLevel } from "./pedagogicalTypes";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EVAL_ANSWER_PATTERNS = [
  "bonne reponse",
  "donne la reponse",
  "donne moi la reponse",
  "quelle est la reponse",
  "c est quoi la reponse",
  "reponse exacte",
  "reponse du qcm",
  "corrige mon qcm",
  "dis moi la reponse",
  "spoil",
  "solution complete",
  "le corrigé",
  "le corrige",
];

/** Demande explicite de la réponse d’évaluation → refus contrôlé. */
export function isEvaluationAnswerRequest(question: string): boolean {
  const n = normalize(question);
  return EVAL_ANSWER_PATTERNS.some((p) => n.includes(p));
}

const INTENT_KEYWORDS: Record<PedagogicalIntent, string[]> = {
  reformuler: ["reformule", "autrement", "plus simple", "en plus simple"],
  donner_exemple: ["exemple", "par exemple", "illustre"],
  fournir_indice: ["indice", "piste", "aide sans repondre", "sans me dire"],
  proposer_mini_exercice: ["mini exercice", "entraine", "entrainement", "exercice court", "pratique"],
  expliquer: ["explique", "expliquer", "c est quoi", "que veut dire", "comprends pas", "je ne comprends"],
};

/**
 * Détecte l’intention pédagogique. Si `forced` est fourni (bouton UI), il gagne.
 */
export function detectPedagogicalIntent(
  question: string,
  forced?: PedagogicalIntent | null,
): PedagogicalIntent {
  if (forced) return forced;
  const n = normalize(question);
  const order: PedagogicalIntent[] = [
    "proposer_mini_exercice",
    "fournir_indice",
    "donner_exemple",
    "reformuler",
    "expliquer",
  ];
  for (const intent of order) {
    if (INTENT_KEYWORDS[intent].some((kw) => n.includes(normalize(kw)))) {
      return intent;
    }
  }
  return "expliquer";
}

export function isPedagogicalLevel(value: string | null | undefined): value is PedagogicalLevel {
  return value === "A1" || value === "A2" || value === "B1" || value === "B2";
}
