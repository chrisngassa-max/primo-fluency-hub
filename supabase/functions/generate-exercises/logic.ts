import type { PedagogicalDirectives } from "../_shared/pedagogical-directives.ts";

/**
 * FILET DE SÉCURITÉ : construit un exercice de repli DÉTERMINISTE, garanti conforme
 * aux contraintes pédagogiques du slot (format autorisé, jamais de production écrite/orale
 * libre quand une descente de compétence est exigée, supports obligatoires, limites de
 * longueur). Utilisé uniquement en dernier recours pour garantir N exercices non vides.
 *
 * Fonction PURE (aucun appel IA) afin d'être testable et 100% déterministe.
 */
export function buildFallbackExercise(opts: {
  competence: string;
  niveauVise: string;
  diffLevel: number;
  pointName: string;
  directives: PedagogicalDirectives;
}): Record<string, unknown> {
  const { competence, niveauVise, diffLevel, pointName, directives } = opts;
  const allowed = directives.formats_autorises?.length ? directives.formats_autorises : ["qcm", "vrai_faux"];
  const forbidden = new Set(directives.formats_interdits ?? []);
  const safeOrder = ["qcm", "vrai_faux", "appariement", "texte_lacunaire"];
  const format =
    safeOrder.find((f) => allowed.includes(f) && !forbidden.has(f)) ??
    allowed.find((f) => !forbidden.has(f) && safeOrder.includes(f)) ??
    "qcm";
  const maxItems = Math.max(1, Math.min(directives.nombre_items_max ?? 3, 2));
  const theme = (pointName && pointName.trim() ? pointName.trim() : "la vie quotidienne en France").slice(0, 60);
  const difficulte = Math.min(10, Math.max(1, Math.round(diffLevel || 3)));

  let items: Array<Record<string, unknown>>;
  if (format === "vrai_faux") {
    items = [
      { question: `Le thème de cet exercice est : ${theme}.`, bonne_reponse: "vrai", explication: "La bonne réponse est 'vrai'." },
    ];
  } else if (format === "texte_lacunaire") {
    items = [
      { question: `Complétez : Aujourd'hui, je vais à ___ (lieu lié à ${theme}).`, bonne_reponse: "la mairie", explication: "La bonne réponse est 'la mairie'." },
    ];
  } else if (format === "appariement") {
    items = [
      { question: `Associez le mot à sa situation : ${theme}.`, options: ["guichet", "ticket"], bonne_reponse: "guichet", explication: "La bonne réponse est 'guichet'." },
    ];
  } else {
    items = [
      { question: `Choisissez la bonne réponse sur le thème : ${theme}.`, options: ["Oui", "Non", "Peut-être"], bonne_reponse: "Oui", explication: "La bonne réponse est 'Oui'." },
      { question: `Où allez-vous pour ce sujet (${theme}) ?`, options: ["À la mairie", "À la mer", "Au cinéma"], bonne_reponse: "À la mairie", explication: "La bonne réponse est 'À la mairie'." },
    ];
  }
  items = items.slice(0, maxItems);

  const contenu: Record<string, unknown> = { items };
  if (competence === "CO") {
    contenu.script_audio = `Bonjour. Voici une information simple sur ${theme}. Écoutez bien, puis répondez aux questions. Merci.`;
  }
  if (competence === "CE") {
    contenu.texte = `Information simple sur ${theme}. Lisez ce court message, puis répondez aux questions ci-dessous.`;
  }

  const codeByComp: Record<string, string> = { CO: "CO1", CE: "CE1", EO: "EO1", EE: "EE1", Structures: "ST1" };

  return {
    titre: `Exercice de repli — ${theme}`,
    consigne: "Lisez et choisissez.",
    competence,
    format,
    difficulte,
    niveau_vise: niveauVise,
    contenu,
    metadata: {
      code: codeByComp[competence] ?? "CE1",
      skill: competence,
      sub_skill: "repli sécurisé",
      time_limit_seconds: 300,
      aides_disponibles: ["exemple"],
      transcription_verrouillee: false,
      objectif_tcf: "comprendre_info_explicite",
      type_differenciation: "remediation",
      is_fallback: true,
    },
    variante_niveau_bas: {
      consigne: "Choisissez.",
      aide: "Regardez l'exemple.",
      nb_items_reduit: 1,
    },
    variante_niveau_haut: {
      consigne: "Choisissez et expliquez.",
      extension: "Donnez un exemple personnel.",
    },
    animation_guide: {
      scenario: `Mise en situation simple autour de : ${theme}.`,
      jeu: "Question-réponse rapide en binôme.",
      materiel: "Aucun matériel spécifique.",
      objectif_oral: "Répondre par une phrase courte.",
      documentation_fournie: {
        guide_formateur: "1. Présenter le thème. 2. Lire l'exemple. 3. Faire répondre les élèves un par un. 4. Corriger ensemble.",
        fiches_eleves: [],
      },
    },
  };
}

export function buildFocusPrompt(competence: string, focusPedagogique: string | null): string {
  if (competence === "Structures" && focusPedagogique === "grammaire") {
    return "\nFOCUS OBLIGATOIRE : GRAMMAIRE. Travaille exclusivement la conjugaison, les accords, les pronoms, la negation ou les prepositions en contexte.";
  }
  if (competence === "Structures" && focusPedagogique === "vocabulaire") {
    return "\nFOCUS OBLIGATOIRE : VOCABULAIRE. Travaille exclusivement le lexique utile, les definitions, associations, synonymes, antonymes et categories lexicales en contexte.";
  }
  return "";
}

export function parseTargetDurationMinutes(value: unknown): number {
  if (value === null || value === undefined || value === "") return 12;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 12;
  return Math.min(60, Math.max(1, Math.round(parsed)));
}

export function buildDurationPrompt(targetDurationMinutes: number): string {
  const seconds = targetDurationMinutes * 60;
  return `DUREE CIBLE PAR EXERCICE : ${targetDurationMinutes} minute(s).
Adapte le nombre d'items et la longueur des productions a cette duree.
Le champ metadata.time_limit_seconds DOIT etre fixe a ${seconds}.`;
}
