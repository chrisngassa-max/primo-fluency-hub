/**
 * Aide d’orientation déterministe par page élève (Lot 2A.4).
 * N’invente jamais une séance, un devoir, un résultat ou une activité.
 * Les faits personnels connus viennent uniquement du snapshot vérifié (optionnel).
 */
import {
  ELEVE_ROUTE_CATALOG,
  ELEVE_TRAINING_EXACT_ROUTES,
  isFormateurOrAdminPath,
  matchEleveRoute,
  normalizePath,
  type EleveRouteInfo,
  type QuickPrompt,
} from "./eleveRouteCatalog";
import type { ContextualAssistantAnswer, PedagogicalLevel } from "./pedagogicalTypes";
import { getPilotDisclaimer } from "./prepareAssistantRequest";

export type PageOrientationFacts = {
  devoirsPendingCount?: number | null;
  prochaineSeanceTitre?: string | null;
  activiteTitre?: string | null;
  objectif?: string | null;
};

export type PageOrientationKind =
  | "where"
  | "purpose"
  | "now"
  | "devoirs"
  | "seance"
  | "results"
  | "resume"
  | "unavailable"
  | "ask_teacher"
  | "how_screen"
  | "tech"
  | "today"
  | "objectif"
  | "activity"
  | "indice"
  | "consigne"
  | "correction"
  | "next_work"
  | null;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectPageOrientationKind(question: string): PageOrientationKind {
  const n = normalize(question);
  if (!n) return null;
  if (n.includes("signaler") && (n.includes("technique") || n.includes("probleme"))) return "tech";
  if (n.includes("probleme technique") || n.includes("aide technique")) return "tech";
  if (n.includes("ou suis") || n.includes("dans quelle page") || n.includes("ou je suis")) return "where";
  if (n.includes("a quoi sert") || n.includes("sert cette page") || n.includes("signifie cet ecran")) return "purpose";
  if (n.includes("que signifie") && n.includes("ecran")) return "purpose";
  if (n.includes("comment utiliser") || n.includes("utiliser cet ecran")) return "how_screen";
  if (n.includes("pourquoi") && (n.includes("indisponible") || n.includes("pas disponible") || n.includes("bloque"))) {
    return "unavailable";
  }
  if (n.includes("besoin du professeur") || n.includes("aide du professeur") || n.includes("demander au professeur")) {
    return "ask_teacher";
  }
  if (n.includes("reprendre") && (n.includes("activite") || n.includes("exercice") || n.includes("travail"))) {
    return "resume";
  }
  if (n.includes("ou sont") && n.includes("devoir")) return "devoirs";
  if (n.includes("ou") && n.includes("devoir")) return "devoirs";
  if (n.includes("prochaine") && n.includes("seance")) return "seance";
  if (n.includes("ou") && n.includes("seance") && !n.includes("objectif")) return "seance";
  if (n.includes("ou voir") && n.includes("resultat")) return "results";
  if (n.includes("mes resultats") || (n.includes("resultat") && n.includes("ou"))) return "results";
  if (n.includes("aujourd")) return "today";
  if (n.includes("que dois") && n.includes("maintenant")) return "now";
  if (n.includes("que dois") && n.includes("travailler")) return "next_work";
  if (n.includes("objectif")) return "objectif";
  if (n.includes("explique") && n.includes("activite")) return "activity";
  if (n.includes("explique") && n.includes("consigne")) return "consigne";
  if (n.includes("indice")) return "indice";
  if (n.includes("correction")) return "correction";
  if (n.includes("que dois-je faire") || n.includes("que dois je faire")) return "now";
  return null;
}

export function isPageOrientationQuestion(question: string): boolean {
  return detectPageOrientationKind(question) !== null;
}

export function quickPromptsForPath(
  pathname: string | null | undefined,
  hasPedagogical: boolean,
): QuickPrompt[] {
  const route = matchEleveRoute(pathname);
  if (!route) {
    return [
      { id: "where", label: "Où suis-je ?", question: "Où suis-je ?" },
      { id: "devoirs", label: "Mes devoirs", question: "Où sont mes devoirs ?" },
      { id: "seance", label: "Ma séance", question: "Où est ma séance ?" },
    ];
  }
  if (route.family === "evaluation") return route.quickPrompts;
  if (hasPedagogical && (route.family === "devoir" || route.family === "seance")) {
    // L’UI conserve aussi les boutons pédagogiques Lot 2A.3 ; ici les prompts page.
    return route.quickPrompts;
  }
  return route.quickPrompts;
}

function answerText(
  kind: Exclude<PageOrientationKind, null>,
  route: EleveRouteInfo | null,
  facts: PageOrientationFacts,
  path: string,
): { text: string; openRoute?: string | null; refused?: boolean } {
  const family = route?.family ?? "inconnu";
  const screen = route?.screen ?? "une page de l’espace élève";
  const purpose = route?.purpose ?? "Trouver ton travail ou une information utile.";

  if (isFormateurOrAdminPath(path)) {
    return {
      text: "Cette page n’est pas dans l’espace élève. Je ne peux pas t’y aider.",
      refused: true,
      openRoute: null,
    };
  }

  if (family === "evaluation") {
    if (kind === "tech" || kind === "ask_teacher") {
      return {
        text: "Pendant le test, je peux seulement noter un problème technique pour le formateur. Je ne donne pas d’indice ni de correction.",
        openRoute: null,
      };
    }
    if (kind === "how_screen" || kind === "where" || kind === "purpose" || kind === "now") {
      return {
        text: `Tu es sur « ${screen} ». ${purpose} Pendant le test, je t’aide seulement à utiliser l’écran. Je ne donne ni indice, ni réponse, ni correction.`,
        openRoute: null,
      };
    }
    if (kind === "indice" || kind === "consigne" || kind === "activity" || kind === "correction" || kind === "next_work") {
      return {
        text: "Pendant une évaluation, je ne donne pas d’indice, de correction ni de conseil sur les réponses. Demande seulement une aide technique si l’écran bloque.",
        refused: true,
        openRoute: null,
      };
    }
    return {
      text: "Pendant le test, reste sur cet écran. Pour un souci technique, utilise « Signaler un problème technique ».",
      refused: kind === "devoirs" || kind === "seance" || kind === "results",
      openRoute: null,
    };
  }

  switch (kind) {
    case "where":
      return { text: `Tu es sur la page « ${screen} ».` };
    case "purpose":
      return { text: `Cette page sert à ceci : ${purpose}` };
    case "how_screen":
      return { text: `Sur « ${screen} », ${purpose} Utilise les boutons de la page pour avancer.` };
    case "now": {
      if (family === "accueil") {
        if ((facts.devoirsPendingCount ?? 0) > 0) {
          return {
            text: `Commence par tes devoirs en attente (${facts.devoirsPendingCount}). Ouvre Mes devoirs.`,
            openRoute: "/eleve/devoirs",
          };
        }
        if (facts.prochaineSeanceTitre) {
          return {
            text: `Ensuite, ouvre ta séance « ${facts.prochaineSeanceTitre} » dans Ma séance.`,
            openRoute: "/eleve/ma-seance",
          };
        }
        return {
          text: "Je ne vois pas encore de devoir ou de séance à te proposer ici. Ouvre Mes devoirs ou Ma séance pour vérifier.",
          openRoute: "/eleve/devoirs",
        };
      }
      if (family === "devoir") {
        return { text: "Sur cette page, ouvre un devoir en attente, ou termine celui qui est affiché." };
      }
      if (family === "seance") {
        return {
          text: facts.activiteTitre
            ? `Continue l’activité « ${facts.activiteTitre} » affichée sur la page.`
            : "Ouvre une activité proposée sur la page. Si la liste est vide, aucune séance n’est disponible pour le moment.",
        };
      }
      if (family === "acces") {
        return { text: "Cette action n’est pas disponible. Reviens à l’accueil ou demande de l’aide au professeur." };
      }
      return { text: `Utilise cette page (« ${screen} ») pour ${purpose.toLowerCase()}` };
    }
    case "today": {
      if ((facts.devoirsPendingCount ?? 0) > 0) {
        return {
          text: `Aujourd’hui, commence par tes devoirs (${facts.devoirsPendingCount} en attente).`,
          openRoute: "/eleve/devoirs",
        };
      }
      if (facts.prochaineSeanceTitre) {
        return {
          text: `Aujourd’hui, ta prochaine séance connue est « ${facts.prochaineSeanceTitre} ».`,
          openRoute: "/eleve/ma-seance",
        };
      }
      return {
        text: "Je n’ai pas de devoir ni de séance confirmés à te proposer pour aujourd’hui. Vérifie Mes devoirs et Ma séance.",
        openRoute: "/eleve/devoirs",
      };
    }
    case "devoirs":
      return {
        text: (facts.devoirsPendingCount ?? 0) > 0
          ? `Tes devoirs sont sur la page Mes devoirs. ${facts.devoirsPendingCount} devoir(s) en attente.`
          : "Tes devoirs sont sur la page Mes devoirs. Ouvre-la pour voir s’il y en a.",
        openRoute: "/eleve/devoirs",
      };
    case "seance":
      return {
        text: facts.prochaineSeanceTitre
          ? `Ta séance connue : « ${facts.prochaineSeanceTitre} ». Elle est sur Ma séance.`
          : "Ouvre Ma séance pour voir s’il y a une séance. Je n’en invente pas.",
        openRoute: "/eleve/ma-seance",
      };
    case "results":
      return {
        text: "Tes résultats et bilans sont dans Progression, ou dans le bilan d’une séance / d’un devoir déjà terminé.",
        openRoute: "/eleve/progression",
      };
    case "resume":
      return {
        text: "Pour reprendre : ouvre Mes devoirs pour un devoir, ou Ma séance pour une séance. Choisis l’activité affichée — je n’en invente pas.",
        openRoute: "/eleve/ma-seance",
      };
    case "unavailable":
      return {
        text: family === "acces"
          ? "Cette action est indisponible pour le moment. Reviens à l’accueil ou contacte le professeur."
          : "Si un bouton est grisé, l’action n’est pas autorisée sur cet écran. Demande de l’aide au professeur si besoin.",
        openRoute: family === "acces" ? "/eleve" : null,
      };
    case "ask_teacher":
      return {
        text: "Dis « J’ai besoin du professeur » pendant une séance ou un devoir ouvert pour transmettre une demande. Sur les autres pages, ouvre l’activité concernée puis demande l’aide.",
        openRoute: family === "accueil" ? "/eleve/ma-seance" : null,
      };
    case "objectif":
      return {
        text: facts.objectif
          ? `Objectif connu pour cette page : ${facts.objectif}`
          : "L’objectif s’affiche sur la page de séance ou d’exercice. S’il n’apparaît pas, je ne peux pas l’inventer.",
      };
    case "activity":
      return {
        text: facts.activiteTitre
          ? `L’activité affichée est « ${facts.activiteTitre} ». Suis la consigne à l’écran.`
          : "Aucune activité n’est confirmée ici. Ouvre une séance ou un devoir rattaché pour continuer.",
      };
    case "consigne":
      return {
        text: "Pour expliquer la consigne, ouvre l’exercice ou le devoir. L’aide utilise alors le contenu validé (sans inventer).",
      };
    case "indice":
      return {
        text: "Les indices ne sont disponibles que dans un exercice autorisé, avec une banque validée. Sinon je refuse clairement.",
      };
    case "correction":
      return {
        text: "La correction s’affiche après remise et libération par le formateur, hors évaluation. Elle n’est jamais inventée.",
      };
    case "next_work":
      return {
        text: (facts.devoirsPendingCount ?? 0) > 0
          ? "Travaille d’abord un devoir en attente, puis reviens à ta séance."
          : facts.prochaineSeanceTitre
            ? `Ensuite, travaille ta séance « ${facts.prochaineSeanceTitre} ».`
            : "Je ne vois pas encore la suite confirmée. Regarde Progression, Mes devoirs et Ma séance.",
        openRoute: (facts.devoirsPendingCount ?? 0) > 0 ? "/eleve/devoirs" : "/eleve/ma-seance",
      };
    case "tech":
      return {
        text: "Décris le problème technique au formateur depuis l’écran concerné (bouton Problème technique pendant une activité).",
      };
    default:
      return { text: `Tu es sur « ${screen} ». ${purpose}` };
  }
}

function allowOpenRoute(route: string | null | undefined, family: string): string | null {
  if (!route) return null;
  const path = normalizePath(route);
  if (family === "evaluation") return null;
  if ((ELEVE_TRAINING_EXACT_ROUTES as readonly string[]).includes(path)) return path;
  if (/^\/eleve\/devoirs\/[0-9a-f-]{36}$/i.test(path)) return path;
  if (/^\/eleve\/seances\/[A-Z][A-Z0-9]{1,6}$/.test(path)) return path;
  return null;
}

export function answerPageOrientation(
  question: string,
  pathname: string | null | undefined,
  options: {
    niveau?: PedagogicalLevel;
    facts?: PageOrientationFacts;
    authenticated?: boolean;
  } = {},
): ContextualAssistantAnswer | null {
  const kind = detectPageOrientationKind(question);
  if (!kind) return null;

  const disclaimer = getPilotDisclaimer();
  const niveau = options.niveau ?? "A2";
  const path = normalizePath(pathname);

  if (options.authenticated === false) {
    return {
      text: "Connecte-toi pour utiliser l’assistant Aide.",
      intent: "refuse_auth",
      uncertain: false,
      refused: true,
      source: "refuse",
      niveau,
      disclaimer,
      aiInvoked: false,
    };
  }

  const route = matchEleveRoute(path);
  const raw = answerText(kind, route, options.facts ?? {}, path);
  const openRoute = allowOpenRoute(raw.openRoute, route?.family ?? "inconnu");

  return {
    text: raw.text,
    intent: "accueil",
    uncertain: false,
    refused: Boolean(raw.refused),
    source: "contextual",
    niveau,
    disclaimer,
    aiInvoked: false,
    provider: "server_context",
    openRoute,
    visibleFallback: false,
  };
}

export function listDeclaredEleveRouteExamples(): string[] {
  return ELEVE_ROUTE_CATALOG.filter((r) => r.family !== "redirect").map((r) => r.pathExample);
}
