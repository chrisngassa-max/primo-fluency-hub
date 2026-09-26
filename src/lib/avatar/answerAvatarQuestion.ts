import faqCorpus from "@/data/captcf-avatar-faq.json";

export type AvatarIntent =
  | "exercice_consigne"
  | "exercice_correction"
  | "parcours_tcf"
  | "niveaux_objectifs"
  | "lexique"
  | "seance"
  | "refuse_admin"
  | "refuse_resultats"
  | "refuse_autre_eleve"
  | "fallback";

export type AvatarAnswerMode = "answer" | "example" | "reformulate";

export type AvatarAnswer = {
  intent: AvatarIntent;
  text: string;
  uncertain: boolean;
  refused: boolean;
  entryId: string | null;
  disclaimer: string;
};

type FaqEntry = (typeof faqCorpus.entries)[number];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreKeywords(haystack: string, keywords: string[]): number {
  let score = 0;
  for (const kw of keywords) {
    const n = normalize(kw);
    if (!n) continue;
    if (haystack.includes(n)) {
      score += n.length >= 4 ? 2 : 1;
      continue;
    }
    // Multi-word keyword: all tokens present (order-independent)
    const parts = n.split(" ").filter(Boolean);
    if (parts.length > 1 && parts.every((p) => haystack.includes(p))) {
      score += 2;
    }
  }
  return score;
}

function matchRefusal(normalized: string): AvatarAnswer | null {
  const { refusals, disclaimer } = faqCorpus;
  if (scoreKeywords(normalized, refusals.admin.keywords) > 0) {
    return {
      intent: "refuse_admin",
      text: refusals.admin.answer_fr,
      uncertain: false,
      refused: true,
      entryId: null,
      disclaimer,
    };
  }
  if (scoreKeywords(normalized, refusals.resultats_officiels.keywords) > 0) {
    return {
      intent: "refuse_resultats",
      text: refusals.resultats_officiels.answer_fr,
      uncertain: false,
      refused: true,
      entryId: null,
      disclaimer,
    };
  }
  if (scoreKeywords(normalized, refusals.autre_eleve.keywords) > 0) {
    return {
      intent: "refuse_autre_eleve",
      text: refusals.autre_eleve.answer_fr,
      uncertain: false,
      refused: true,
      entryId: null,
      disclaimer,
    };
  }
  return null;
}

function pickEntry(normalized: string): { entry: FaqEntry; score: number } | null {
  let best: { entry: FaqEntry; score: number } | null = null;
  for (const entry of faqCorpus.entries) {
    const score = scoreKeywords(normalized, entry.keywords);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { entry, score };
  }
  return best;
}

function textForMode(entry: FaqEntry, mode: AvatarAnswerMode): string {
  if (mode === "example") return entry.example_fr;
  if (mode === "reformulate") return entry.reformulation_fr;
  return entry.answer_fr;
}

/**
 * Réponse FAQ CapTCF 100 % locale — aucun appel API, aucune donnée élève.
 */
export function answerAvatarQuestion(
  question: string,
  mode: AvatarAnswerMode = "answer",
): AvatarAnswer {
  const disclaimer = faqCorpus.disclaimer;
  const trimmed = question.trim();
  if (!trimmed) {
    return {
      intent: "fallback",
      text: "Écris une question courte (consigne, correction, mot, TCF…). ",
      uncertain: true,
      refused: false,
      entryId: null,
      disclaimer,
    };
  }

  const normalized = normalize(trimmed);
  const refusal = matchRefusal(normalized);
  if (refusal) return refusal;

  const matched = pickEntry(normalized);
  if (!matched || matched.score < 2) {
    return {
      intent: "fallback",
      text: faqCorpus.fallback.answer_fr,
      uncertain: true,
      refused: false,
      entryId: null,
      disclaimer,
    };
  }

  return {
    intent: matched.entry.intent as AvatarIntent,
    text: textForMode(matched.entry, mode),
    uncertain: false,
    refused: false,
    entryId: matched.entry.id,
    disclaimer,
  };
}

export function listAvatarFaqIntents(): string[] {
  return faqCorpus.entries.map((e) => e.intent);
}
