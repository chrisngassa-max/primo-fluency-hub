/** Niveaux pédagogiques supportés par l’assistant contextuel. */
export type PedagogicalLevel = "A1" | "A2" | "B1" | "B2";

/** Intentions MVP Lot 3B-2. */
export type PedagogicalIntent =
  | "expliquer"
  | "reformuler"
  | "donner_exemple"
  | "fournir_indice"
  | "proposer_mini_exercice";

/**
 * Contexte séance/exercice affiché et transmis au moteur.
 * Aucune donnée personnelle (id, email, nom, score, …).
 */
export type AidePedagogiqueContext = {
  sessionCode: string | null;
  sessionTitre: string | null;
  objectif: string | null;
  niveau: PedagogicalLevel;
  leconTitre: string | null;
  exerciceTitre: string | null;
  exerciceConsigne: string | null;
  exerciceCompetence: string | null;
};

export const DEFAULT_AIDE_CONTEXT: AidePedagogiqueContext = {
  sessionCode: null,
  sessionTitre: null,
  objectif: null,
  niveau: "A2",
  leconTitre: null,
  exerciceTitre: null,
  exerciceConsigne: null,
  exerciceCompetence: null,
};

export type PreparedAssistantRequest = {
  question: string;
  intent: PedagogicalIntent;
  niveau: PedagogicalLevel;
  session: {
    code: string;
    titre: string;
    objectifs: string[];
  };
  lecon: { titre: string } | null;
  exercice: {
    titre: string;
    consigne: string | null;
    competence: string | null;
  } | null;
  /** Faits / lexique / aides validés — jamais de corrigé. */
  sources: {
    faits: string[];
    lexique: { mot: string; definition_simple: string; exemple: string }[];
    aides: string[];
    mini_exercice: string | null;
  };
  meta: {
    provider_mode: "local_deterministic" | "edge_prepared" | "unavailable";
    corpus_version: string;
  };
};

export type ContextualAssistantAnswer = {
  text: string;
  intent:
    | PedagogicalIntent
    | "refuse_evaluation"
    | "refuse_sources"
    | "refuse_auth"
    | "refuse_consent"
    | "refuse_quota"
    | "faq_fallback";
  uncertain: boolean;
  refused: boolean;
  source: "contextual" | "faq" | "refuse";
  niveau: PedagogicalLevel;
  disclaimer: string;
  /** True si un provider IA a réellement été invoqué (pas FAQ / refus). */
  aiInvoked?: boolean;
};
