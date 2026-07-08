export type CaptcfLevel = "A0" | "A1" | "A2" | "B1" | "B2" | "C1";

export type CaptcfLevelProfile = {
  level: CaptcfLevel;
  label: string;
  phraseLength: string;
  lexicalComplexity: string;
  questionStyle: string;
  supportLevel: string;
  expectedProduction: string;
  qcmRule: string;
  dialogueRule: string;
  responseLines: number;
  promptHint: string;
};

export const CAPTCF_DIALOGUE_TARGET_SECONDS = 150;
export const CAPTCF_DIALOGUE_MIN_SECONDS = 145;
export const CAPTCF_DIALOGUE_MAX_SECONDS = 155;

export const CAPTCF_LEVEL_PROFILES: Record<CaptcfLevel, CaptcfLevelProfile> = {
  A0: {
    level: "A0",
    label: "A0 - entree dans l'ecrit",
    phraseLength: "mots isoles, consignes tres courtes",
    lexicalComplexity: "lexique de survie, pictogrammes, repetition",
    questionStyle: "appariement, reperage visuel, choix binaire",
    supportLevel: "guidage maximal, modele donne, reformulation orale",
    expectedProduction: "copie, mots simples, informations personnelles",
    qcmRule: "2 questions maximum, 2 options, images ou mots tres transparents",
    dialogueRule: "dialogue tres lent, tours courts, repetitions explicites",
    responseLines: 3,
    promptHint: "Adapter pour un apprenant tres debutant, avec etayage visuel fort.",
  },
  A1: {
    level: "A1",
    label: "A1 - utilisateur elementaire",
    phraseLength: "phrases tres courtes, une idee par phrase",
    lexicalComplexity: "lexique concret, quotidien et administratif tres simple",
    questionStyle: "reperage direct, vrai/faux, QCM a 3 options",
    supportLevel: "aides fortes, exemple avant exercice, mots cles visibles",
    expectedProduction: "phrases guidees, formulaire, message tres court",
    qcmRule: "2 a 3 questions, distracteurs simples, reponse explicite dans le document",
    dialogueRule: "2 min 25 a 2 min 35, debit lent, informations repetees",
    responseLines: 4,
    promptHint: "Produire un contenu A1 clair, concret, fortement guide.",
  },
  A2: {
    level: "A2",
    label: "A2 - utilisateur elementaire autonome",
    phraseLength: "phrases simples, coordination limitee",
    lexicalComplexity: "lexique administratif courant, contexte explicite",
    questionStyle: "comprehension directe, classement, reponse courte",
    supportLevel: "aides moderees, amorces et lexique utile",
    expectedProduction: "message court, demande simple, justification minimale",
    qcmRule: "3 a 5 questions, 3 ou 4 options, une bonne reponse non ambigue",
    dialogueRule: "2 min 25 a 2 min 35, debit naturel ralenti, situation concrete",
    responseLines: 6,
    promptHint: "Produire un contenu A2 simple mais utilisable en autonomie partielle.",
  },
  B1: {
    level: "B1",
    label: "B1 - utilisateur independant",
    phraseLength: "phrases developpees, connecteurs simples",
    lexicalComplexity: "lexique administratif et social plus precis",
    questionStyle: "reperage + inference legere + justification courte",
    supportLevel: "aides reduites, relances possibles, peu de modele",
    expectedProduction: "paragraphe structure, avis simple, justification",
    qcmRule: "4 a 6 questions, distracteurs plausibles, justification formateur",
    dialogueRule: "2 min 25 a 2 min 35, debit quasi naturel, implicite leger",
    responseLines: 8,
    promptHint: "Produire un contenu B1 avec justification et autonomie croissante.",
  },
  B2: {
    level: "B2",
    label: "B2 - utilisateur independant avance",
    phraseLength: "phrases complexes, nuances et reformulations",
    lexicalComplexity: "lexique abstrait, institutionnel, argumentatif",
    questionStyle: "implicite, intention, synthese, argumentation",
    supportLevel: "aides minimales, consignes d'examen, correction exigeante",
    expectedProduction: "argumentation courte, opinion nuancee, synthese",
    qcmRule: "5 a 7 questions, distracteurs fins, une seule reponse defendable",
    dialogueRule: "2 min 25 a 2 min 35, debit naturel, informations implicites",
    responseLines: 10,
    promptHint: "Produire un contenu B2 dense, nuance, proche des exigences TCF.",
  },
  C1: {
    level: "C1",
    label: "C1 - utilisateur experimente",
    phraseLength: "phrases complexes, registre soutenu possible",
    lexicalComplexity: "lexique specialise, implicite culturel et institutionnel",
    questionStyle: "analyse fine, reformulation, prise de position",
    supportLevel: "aides tres faibles, autonomie complete",
    expectedProduction: "argumentation developpee et structuree",
    qcmRule: "questions d'analyse, distracteurs tres proches, justification fine",
    dialogueRule: "2 min 25 a 2 min 35, debit naturel, sous-entendus possibles",
    responseLines: 12,
    promptHint: "Produire un contenu C1 exigeant, analytique et nuance.",
  },
};

export function normalizeCaptcfLevel(level?: string | null): CaptcfLevel {
  const raw = String(level ?? "").trim().toUpperCase();
  if (raw === "A0" || raw === "A1" || raw === "A2" || raw === "B1" || raw === "B2" || raw === "C1") {
    return raw;
  }
  return "A2";
}

export function getCaptcfLevelProfile(level?: string | null): CaptcfLevelProfile {
  return CAPTCF_LEVEL_PROFILES[normalizeCaptcfLevel(level)];
}

export function getCaptcfLevelProfileSummary(level?: string | null) {
  const profile = getCaptcfLevelProfile(level);
  return {
    level: profile.level,
    label: profile.label,
    phraseLength: profile.phraseLength,
    lexicalComplexity: profile.lexicalComplexity,
    questionStyle: profile.questionStyle,
    supportLevel: profile.supportLevel,
    expectedProduction: profile.expectedProduction,
    qcmRule: profile.qcmRule,
    dialogueRule: profile.dialogueRule,
    responseLines: profile.responseLines,
    promptHint: profile.promptHint,
    dialogueTargetSeconds: CAPTCF_DIALOGUE_TARGET_SECONDS,
    dialogueMinSeconds: CAPTCF_DIALOGUE_MIN_SECONDS,
    dialogueMaxSeconds: CAPTCF_DIALOGUE_MAX_SECONDS,
  };
}

export function resolveCaptcfDocumentLevel(input: {
  explicitLevel?: string | null;
  exerciseLevel?: string | null;
  sessionLevel?: string | null;
  groupLevel?: string | null;
  fallback?: string | null;
}) {
  return normalizeCaptcfLevel(
    input.explicitLevel ?? input.exerciseLevel ?? input.sessionLevel ?? input.groupLevel ?? input.fallback ?? "A2",
  );
}
