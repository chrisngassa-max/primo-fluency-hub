/**
 * Catalogue exact des routes de l’espace élève (déclarées dans App.tsx).
 * Aucune route inventée. Utilisé pour l’aide contextuelle Lot 2A.4.
 */

export type EleveRouteFamily =
  | "accueil"
  | "seance"
  | "devoir"
  | "bilan"
  | "resultats"
  | "progression"
  | "carnet"
  | "profil"
  | "evaluation"
  | "acces"
  | "redirect"
  | "inconnu";

export type QuickPrompt = {
  id: string;
  label: string;
  question: string;
  /** Si true, envoie helpCategory technique. */
  technical?: boolean;
};

export type EleveRouteInfo = {
  id: string;
  /** Motif de chemin (pathname HashRouter, sans #). */
  pattern: RegExp;
  /** Chemin canonique d’exemple (sans params dynamiques si possible). */
  pathExample: string;
  family: EleveRouteFamily;
  screen: string;
  purpose: string;
  availableContext: string;
  quickPrompts: QuickPrompt[];
  navigationHints: string[];
  restrictions: string[];
};

const ACCUEIL_PROMPTS: QuickPrompt[] = [
  { id: "today", label: "Aujourd’hui", question: "Que dois-je faire aujourd’hui ?" },
  { id: "devoirs", label: "Mes devoirs", question: "Où sont mes devoirs ?" },
  { id: "seance", label: "Ma séance", question: "Quelle est ma prochaine séance ?" },
];

const SEANCE_PROMPTS: QuickPrompt[] = [
  { id: "objectif", label: "Objectif", question: "Quel est l’objectif ?" },
  { id: "activite", label: "Cette activité", question: "Explique-moi cette activité." },
  { id: "prof", label: "Professeur", question: "J’ai besoin du professeur" },
];

const DEVOIR_PROMPTS: QuickPrompt[] = [
  { id: "consigne", label: "Consigne", question: "Explique-moi la consigne." },
  { id: "indice", label: "Indice", question: "Puis-je avoir un indice ?" },
  { id: "correction", label: "Correction", question: "Quand verrai-je la correction ?" },
];

const RESULT_PROMPTS: QuickPrompt[] = [
  { id: "ecran", label: "Cet écran", question: "Que signifie cet écran ?" },
  { id: "suite", label: "Ensuite", question: "Que dois-je travailler ensuite ?" },
];

const EVAL_PROMPTS: QuickPrompt[] = [
  { id: "utiliser", label: "Utiliser l’écran", question: "Comment utiliser cet écran ?" },
  { id: "technique", label: "Problème technique", question: "Signaler un problème technique.", technical: true },
];

const ORIENT_PROMPTS: QuickPrompt[] = [
  { id: "ou", label: "Où suis-je ?", question: "Où suis-je ?" },
  { id: "sert", label: "À quoi sert ?", question: "À quoi sert cette page ?" },
  { id: "faire", label: "Maintenant", question: "Que dois-je faire maintenant ?" },
];

/** Routes élève réellement déclarées dans App.tsx (sandbox + normal). */
export const ELEVE_ROUTE_CATALOG: EleveRouteInfo[] = [
  {
    id: "accueil",
    pattern: /^\/eleve\/?$/,
    pathExample: "/eleve",
    family: "accueil",
    screen: "Accueil / tableau de bord",
    purpose: "Voir le travail du jour, les devoirs et la séance.",
    availableContext: "Devoirs et séances rattachés à l’élève (vérifiés côté serveur).",
    quickPrompts: ACCUEIL_PROMPTS,
    navigationHints: ["/eleve/devoirs", "/eleve/ma-seance", "/eleve/progression"],
    restrictions: ["Ne pas inventer une séance ou un devoir absent."],
  },
  {
    id: "acces-limite",
    pattern: /^\/eleve\/acces-limite\/?$/,
    pathExample: "/eleve/acces-limite",
    family: "acces",
    screen: "Accès limité",
    purpose: "Expliquer qu’une activité n’est pas encore disponible.",
    availableContext: "Motif d’accès limité affiché par la page.",
    quickPrompts: [
      ...ORIENT_PROMPTS,
      { id: "pourquoi", label: "Pourquoi ?", question: "Pourquoi cette action est-elle indisponible ?" },
    ],
    navigationHints: ["/eleve", "/eleve/profil"],
    restrictions: ["Pas d’invention de contenu pédagogique."],
  },
  {
    id: "profil",
    pattern: /^\/eleve\/profil\/?$/,
    pathExample: "/eleve/profil",
    family: "profil",
    screen: "Mon profil",
    purpose: "Consulter et mettre à jour les informations personnelles autorisées.",
    availableContext: "Profil élève de la session connectée.",
    quickPrompts: [
      ...ORIENT_PROMPTS,
      { id: "devoirs", label: "Mes devoirs", question: "Où sont mes devoirs ?" },
    ],
    navigationHints: ["/eleve", "/eleve/devoirs"],
    restrictions: ["Aucune donnée formateur."],
  },
  {
    id: "ma-seance",
    pattern: /^\/eleve\/ma-seance\/?$/,
    pathExample: "/eleve/ma-seance",
    family: "seance",
    screen: "Ma séance",
    purpose: "Voir la séance en cours ou à venir et ouvrir les activités.",
    availableContext: "Séance liée aux groupes de l’élève.",
    quickPrompts: SEANCE_PROMPTS,
    navigationHints: ["/eleve/mes-seances", "/eleve/devoirs"],
    restrictions: ["Ne pas inventer une séance.", "En évaluation : aide technique seulement."],
  },
  {
    id: "mes-seances",
    pattern: /^\/eleve\/mes-seances\/?$/,
    pathExample: "/eleve/mes-seances",
    family: "seance",
    screen: "Mes séances",
    purpose: "Parcourir l’historique et les séances disponibles.",
    availableContext: "Liste des séances rattachées.",
    quickPrompts: [
      ...ORIENT_PROMPTS,
      { id: "prochaine", label: "Prochaine séance", question: "Quelle est ma prochaine séance ?" },
    ],
    navigationHints: ["/eleve/ma-seance"],
    restrictions: ["Ne pas inventer une séance."],
  },
  {
    id: "seance-code",
    pattern: /^\/eleve\/seances\/[^/]+\/?$/,
    pathExample: "/eleve/seances/:sessionCode",
    family: "seance",
    screen: "Séance (parcours)",
    purpose: "Réaliser les exercices de la séance ouverte.",
    availableContext: "Séance et exercice courant si rattachés ; aide pédagogique Lot 2A.3 si exercice publié.",
    quickPrompts: SEANCE_PROMPTS,
    navigationHints: ["/eleve/ma-seance", "/eleve/devoirs"],
    restrictions: ["Indices seulement via banque validée.", "Pas de fuite de correction."],
  },
  {
    id: "redirect-s01",
    pattern: /^\/eleve\/exercices-interactifs\/s01\/?$/,
    pathExample: "/eleve/exercices-interactifs/s01",
    family: "redirect",
    screen: "Redirection S01",
    purpose: "Redirige vers le parcours intégré (jamais une page autonome).",
    availableContext: "Aucun.",
    quickPrompts: ACCUEIL_PROMPTS,
    navigationHints: ["/eleve/seances/S01"],
    restrictions: ["Route de redirection uniquement."],
  },
  {
    id: "test-niveau",
    pattern: /^\/eleve\/test-positionnement\/?$/,
    pathExample: "/eleve/test-positionnement",
    family: "evaluation",
    screen: "Test de niveau (accueil)",
    purpose: "Préparer ou démarrer un test de positionnement.",
    availableContext: "Écrans de test autorisés pour l’élève.",
    quickPrompts: EVAL_PROMPTS,
    navigationHints: ["/eleve"],
    restrictions: ["Aucun indice, aucune correction, aucun replay interdit."],
  },
  {
    id: "test-passer",
    pattern: /^\/eleve\/test-positionnement\/passer\/[^/]+\/?$/,
    pathExample: "/eleve/test-positionnement/passer/:token",
    family: "evaluation",
    screen: "Passation du test",
    purpose: "Passer le test de positionnement.",
    availableContext: "Écran de passation uniquement.",
    quickPrompts: EVAL_PROMPTS,
    navigationHints: [],
    restrictions: [
      "Aide technique et utilisation de l’écran seulement.",
      "Aucun indice, replay, explication ou recommandation révélatrice.",
    ],
  },
  {
    id: "test-resultat",
    pattern: /^\/eleve\/test-positionnement\/resultat\/[^/]+\/?$/,
    pathExample: "/eleve/test-positionnement/resultat/:attemptId",
    family: "resultats",
    screen: "Résultat du test de niveau",
    purpose: "Lire le résultat du test déjà passé.",
    availableContext: "Résultat de la tentative de l’élève connecté.",
    quickPrompts: RESULT_PROMPTS,
    navigationHints: ["/eleve", "/eleve/progression"],
    restrictions: ["Ne pas inventer un score absent."],
  },
  {
    id: "devoirs",
    pattern: /^\/eleve\/devoirs\/?$/,
    pathExample: "/eleve/devoirs",
    family: "devoir",
    screen: "Mes devoirs",
    purpose: "Voir et ouvrir les devoirs assignés.",
    availableContext: "Devoirs dont eleve_id = auth.uid().",
    quickPrompts: [
      ...ORIENT_PROMPTS,
      { id: "aujourdhui", label: "Aujourd’hui", question: "Que dois-je faire aujourd’hui ?" },
    ],
    navigationHints: ["/eleve/ma-seance"],
    restrictions: ["Ne pas inventer un devoir."],
  },
  {
    id: "devoir-passation",
    pattern: /^\/eleve\/devoirs\/[^/]+\/?$/,
    pathExample: "/eleve/devoirs/:devoirId",
    family: "devoir",
    screen: "Passation d’un devoir",
    purpose: "Répondre au devoir ouvert.",
    availableContext: "Devoir rattaché + exercice publié (Lot 2A.3).",
    quickPrompts: DEVOIR_PROMPTS,
    navigationHints: ["/eleve/devoirs"],
    restrictions: ["Indice selon banque et mode.", "Correction seulement après remise et libération."],
  },
  {
    id: "carnet",
    pattern: /^\/eleve\/carnet\/?$/,
    pathExample: "/eleve/carnet",
    family: "carnet",
    screen: "Mon carnet de mots",
    purpose: "Revoir le lexique personnel.",
    availableContext: "Entrées du carnet de l’élève.",
    quickPrompts: [
      ...ORIENT_PROMPTS,
      { id: "reprendre", label: "Reprendre", question: "Comment reprendre une activité ?" },
    ],
    navigationHints: ["/eleve/devoirs", "/eleve/ma-seance"],
    restrictions: ["Pas de correction d’exercice ici."],
  },
  {
    id: "bilan-seance",
    pattern: /^\/eleve\/bilan\/[^/]+\/?$/,
    pathExample: "/eleve/bilan/:sessionId",
    family: "bilan",
    screen: "Bilan de séance",
    purpose: "Relire le bilan d’une séance terminée.",
    availableContext: "Bilan de la séance de l’élève.",
    quickPrompts: RESULT_PROMPTS,
    navigationHints: ["/eleve/mes-seances", "/eleve/devoirs"],
    restrictions: ["Ne pas inventer un bilan."],
  },
  {
    id: "exercices-seance",
    pattern: /^\/eleve\/exercices-seance\/[^/]+\/?$/,
    pathExample: "/eleve/exercices-seance/:sessionId",
    family: "bilan",
    screen: "Exercices de séance / bilan",
    purpose: "Revoir les exercices d’une séance (écran bilan).",
    availableContext: "Séance rattachée.",
    quickPrompts: RESULT_PROMPTS,
    navigationHints: ["/eleve/ma-seance"],
    restrictions: ["Ne pas inventer une activité."],
  },
  {
    id: "bilan-test",
    pattern: /^\/eleve\/bilan-test\/[^/]+\/?$/,
    pathExample: "/eleve/bilan-test/:testId",
    family: "bilan",
    screen: "Bilan de test",
    purpose: "Consulter le bilan d’un test déjà passé.",
    availableContext: "Bilan du test de l’élève.",
    quickPrompts: RESULT_PROMPTS,
    navigationHints: ["/eleve", "/eleve/devoirs"],
    restrictions: ["Pas d’indices sur un test en cours (cet écran est un bilan)."],
  },
  {
    id: "bilan-devoirs",
    pattern: /^\/eleve\/bilan-devoirs\/[^/]+\/?$/,
    pathExample: "/eleve/bilan-devoirs/:bilanId",
    family: "bilan",
    screen: "Bilan de devoirs",
    purpose: "Lire le bilan après un devoir remis.",
    availableContext: "Bilan du devoir de l’élève.",
    quickPrompts: RESULT_PROMPTS,
    navigationHints: ["/eleve/devoirs"],
    restrictions: ["Ne pas inventer une correction absente."],
  },
  {
    id: "progression",
    pattern: /^\/eleve\/progression\/?$/,
    pathExample: "/eleve/progression",
    family: "progression",
    screen: "Ma progression",
    purpose: "Suivre les compétences et la progression personnelle.",
    availableContext: "Indicateurs liés à l’élève connecté.",
    quickPrompts: RESULT_PROMPTS,
    navigationHints: ["/eleve/devoirs", "/eleve/ma-seance"],
    restrictions: ["Ne pas inventer un niveau ou un score."],
  },
];

/** Chemins exacts autorisés pour open_route en entraînement (élargissement Lot 2A.4). */
export const ELEVE_TRAINING_EXACT_ROUTES = [
  "/eleve",
  "/eleve/ma-seance",
  "/eleve/mes-seances",
  "/eleve/devoirs",
  "/eleve/carnet",
  "/eleve/progression",
  "/eleve/profil",
  "/eleve/acces-limite",
  "/eleve/test-positionnement",
] as const;

export function matchEleveRoute(pathname: string | null | undefined): EleveRouteInfo | null {
  const path = normalizePath(pathname);
  if (!path.startsWith("/eleve")) return null;
  for (const route of ELEVE_ROUTE_CATALOG) {
    if (route.pattern.test(path)) return route;
  }
  return null;
}

export function normalizePath(pathname: string | null | undefined): string {
  if (!pathname) return "";
  let path = pathname.trim();
  if (path.startsWith("#")) path = path.slice(1);
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path || "/";
}

export function isFormateurOrAdminPath(pathname: string | null | undefined): boolean {
  const path = normalizePath(pathname);
  return path === "/formateur" || path.startsWith("/formateur/") || path.startsWith("/admin");
}

export function isEleveAppPath(pathname: string | null | undefined): boolean {
  const path = normalizePath(pathname);
  return path === "/eleve" || (path.startsWith("/eleve/") && path !== "/eleve/login");
}

export function pageFamilyFromPath(pathname: string | null | undefined): EleveRouteFamily {
  return matchEleveRoute(pathname)?.family ?? "inconnu";
}

export function isEvaluationPassationPath(pathname: string | null | undefined): boolean {
  const path = normalizePath(pathname);
  return /^\/eleve\/test-positionnement\/passer\//.test(path);
}

export function sensitiveContextKey(pathname: string | null | undefined, userId: string | null | undefined): string {
  const route = matchEleveRoute(pathname);
  const family = route?.family ?? "inconnu";
  // Grouper bilans et résultats ; isoler évaluation active et passation devoir.
  return `${userId ?? "anon"}:${family}:${route?.id ?? "none"}`;
}
