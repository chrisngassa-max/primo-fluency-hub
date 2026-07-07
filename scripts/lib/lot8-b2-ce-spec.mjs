/**
 * Lot 8 pilote B2 CE — définitions de slots, normalisation et gabarits déterministes.
 * Fonctions pures (aucun I/O) — testables sans Supabase.
 */

import { computeExerciseDuration } from "../../supabase/functions/_shared/exercise-duration.ts";

export const B2_CE_THEMES = ["prefecture", "vie_citoyenne", "travail", "logement"];

export const LOT8_B2_CE_SLOTS = [
  { seq: 1, metadata_code: "sf-p0:B2:CE:001", format: "qcm", theme: "prefecture" },
  { seq: 2, metadata_code: "sf-p0:B2:CE:002", format: "qcm", theme: "vie_citoyenne" },
  { seq: 3, metadata_code: "sf-p0:B2:CE:003", format: "qcm", theme: "travail" },
  { seq: 4, metadata_code: "sf-p0:B2:CE:004", format: "vrai_faux", theme: "logement" },
  { seq: 5, metadata_code: "sf-p0:B2:CE:005", format: "texte_lacunaire", theme: "prefecture" },
];

export const FORBIDDEN_ISSUE_CODES = {
  qcm: ["qcm_no_options", "qcm_answer_not_in_options", "missing_ce_text", "correction_not_in_text"],
  vrai_faux: ["vf_invalid_answer", "missing_ce_text"],
  texte_lacunaire: ["missing_ce_text"],
};

const THEME_LABELS = {
  prefecture: "préfecture et démarches administratives",
  vie_citoyenne: "citoyenneté et valeurs de la République",
  travail: "emploi et monde du travail",
  logement: "logement et droits des locataires",
};

export function countWords(text) {
  if (typeof text !== "string" || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function themeLabel(theme) {
  return THEME_LABELS[theme] ?? theme;
}

/** Normalise un item vrai/faux (pattern regenerate-exercise-item). */
export function normalizeVraiFauxItem(item) {
  const normalized = { ...item };
  const raw = String(normalized.bonne_reponse ?? "").trim().toLowerCase();
  if (raw === "true" || raw === "vrai") normalized.bonne_reponse = "vrai";
  else if (raw === "false" || raw === "faux") normalized.bonne_reponse = "faux";
  normalized.options = ["vrai", "faux"];
  return normalized;
}

export function normalizeItems(format, items) {
  const list = Array.isArray(items) ? items : [];
  return list.map((item) => {
    if (format === "vrai_faux") return normalizeVraiFauxItem(item);
    return { ...item };
  });
}

export function finalizeDraftExercise(slot, generated, { generationMode = "deterministic" } = {}) {
  const format = slot.format;
  const items = normalizeItems(format, generated.contenu?.items ?? []);
  const texte = generated.contenu?.texte ?? "";

  const contenu = {
    ...generated.contenu,
    texte,
    items,
    metadata: {
      code: "CE3",
      objectif_tcf: "comprendre_info_implicite",
      ...(generated.contenu?.metadata ?? {}),
    },
  };

  const draft = {
    titre: generated.titre,
    consigne: generated.consigne,
    competence: "CE",
    format,
    niveau_vise: "B2",
    difficulte: 5,
    niveau_guidage: "autonome",
    theme: slot.theme,
    contexte_irn: slot.theme,
    source: "search_first_p0",
    metadata_code: slot.metadata_code,
    objectif_tcf: "comprendre_info_implicite",
    validation_profile: "generated_strict",
    is_ai_generated: generationMode !== "deterministic",
    is_template: false,
    is_devoir: false,
    contenu,
  };

  contenu.metadata.time_limit_seconds = computeExerciseDuration({
    competence: draft.competence,
    format: draft.format,
    metadata: contenu.metadata,
    contenu,
  });

  return draft;
}

export function countDistinctThemes(entries) {
  return new Set(entries.map((e) => e.draft?.theme).filter(Boolean)).size;
}

export function checkTextWordCount(draft) {
  const words = countWords(draft.contenu?.texte);
  return words >= 150 && words <= 250;
}

export function hasForbiddenIssue(validation, format) {
  const codes = FORBIDDEN_ISSUE_CODES[format] ?? [];
  return validation.issues.some((i) => codes.includes(i.code) && i.severity === "error");
}

export function checkEntryConstraints(draft, validation) {
  const checks = {
    hasUsableContent: !validation.issues.some(
      (i) => i.code === "not_usable_content" && i.severity === "error",
    ),
    notRejected: validation.status !== "rejected",
    noForbiddenCodes: !hasForbiddenIssue(validation, draft.format),
    textWordCountOk: checkTextWordCount(draft),
    themePresent: Boolean(draft.theme),
    metadataCodeOk: /^sf-p0:B2:CE:\d{3}$/.test(draft.metadata_code ?? ""),
  };
  checks.allOk = Object.values(checks).every(Boolean);
  return checks;
}

/** Gabarits déterministes B2 CE — textes 150–250 mots, validation-friendly. */
const DETERMINISTIC_TEMPLATES = {
  "sf-p0:B2:CE:001": {
    titre: "Courrier préfectoral : comprendre la convocation",
    consigne: "Lisez le courrier et répondez à la question.",
    contenu: {
      texte: `Madame, Monsieur,

Nous avons examiné votre dossier de demande de renouvellement de titre de séjour déposé le 12 mars 2026. Après vérification de vos justificatifs, nous vous informons que votre demande est recevable. Vous êtes convoqué le 28 avril 2026 à 9 h 30 au guichet des étrangers de la préfecture du Val-de-Marne, situé au 2, avenue du Général de Gaulle à Créteil. Vous devez vous présenter muni de votre passeport, de votre titre de séjour actuel, de trois photos d'identité récentes, de votre attestation d'hébergement et de vos trois derniers bulletins de salaire. En l'absence de pièces complémentaires demandées lors de l'entretien, le traitement de votre dossier pourrait être retardé. La décision définitive vous sera notifiée par courrier recommandé dans un délai maximal de quatre mois. Pour toute information complémentaire, vous pouvez consulter le site service-public.fr ou appeler le numéro d'information de la préfecture du lundi au vendredi de 9 h à 17 h. Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.

Le préfet`,
      items: [
        {
          question: "À quelle date l'intéressé est-il convoqué au guichet des étrangers ?",
          options: ["28 avril 2026", "12 mars 2026", "dans quatre mois", "le lundi au vendredi"],
          bonne_reponse: "28 avril 2026",
          explication: "La convocation indique explicitement le 28 avril 2026 à 9 h 30.",
        },
      ],
    },
  },
  "sf-p0:B2:CE:002": {
    titre: "Article presse — laïcité et école publique",
    consigne: "Lisez l'article et répondez à la question.",
    contenu: {
      texte: `La laïcité à l'école publique française repose sur le principe de neutralité de l'État et sur le respect de toutes les convictions. Depuis la loi de 1905, aucun élève ne peut être contraint de manifester une appartenance religieuse dans l'enceinte de l'établissement. Les signes ostentatoires sont interdits afin de préserver un climat d'apprentissage commun. Les enseignants transmettent les valeurs de la République : liberté, égalité, fraternité. Ils organisent des débats sur la citoyenneté pour aider les jeunes à comprendre leurs droits et leurs devoirs. Les familles sont associées à cette mission par des réunions d'information et des projets interculturels. La laïcité ne signifie pas l'opposition aux religions, mais la séparation des institutions publiques et des cultes. Elle garantit à chaque enfant un accès égal à l'éducation, quelle que soit son origine. Les chefs d'établissement veillent à l'application de ces règles et peuvent solliciter l'inspection académique en cas de difficulté. Cette exigence civique prépare les élèves à vivre ensemble dans une société diverse et respectueuse.`,
      items: [
        {
          question: "Selon l'article, quelles valeurs les enseignants transmettent-ils ?",
          options: [
            "liberté, égalité, fraternité",
            "travail, famille, patrie",
            "unité, discipline, obéissance",
            "commerce, industrie, agriculture",
          ],
          bonne_reponse: "liberté, égalité, fraternité",
          explication: "Le texte cite explicitement liberté, égalité, fraternité.",
        },
      ],
    },
  },
  "sf-p0:B2:CE:003": {
    titre: "Offre d'emploi — comprendre les conditions",
    consigne: "Lisez l'annonce et répondez à la question.",
    contenu: {
      texte: `L'entreprise LogiTrans, spécialisée dans la logistique urbaine, recrute un coordinateur de quai en CDI à temps plein. Le poste est basé à Lyon et nécessite une expérience minimale de trois ans dans la gestion d'équipes. Le candidat devra maîtriser les outils numériques de planification et posséder le permis B. La rémunération annuelle brute est comprise entre 32 000 et 36 000 euros, selon le profil. Les horaires incluent des déplacements occasionnels le week-end. L'entreprise propose une mutuelle, un ticket restaurant et un accord de télétravail partiel après la période d'essai de quatre mois. Les candidatures doivent être envoyées avant le 15 juin 2026 à l'adresse recrutement@logitrans.fr, accompagnées d'un CV et d'une lettre de motivation. Un entretien en présentiel sera organisé avec le responsable des ressources humaines. France Travail référence cette offre sous le numéro 2026-LYO-8842. Les personnes en situation de handicap sont encouragées à postuler : des aménagements de poste peuvent être étudiés. L'embauche est prévue pour le 1er septembre 2026.`,
      items: [
        {
          question: "Quelle est la durée de la période d'essai mentionnée ?",
          options: ["quatre mois", "trois ans", "un week-end", "quinze jours"],
          bonne_reponse: "quatre mois",
          explication: "L'annonce précise une période d'essai de quatre mois.",
        },
      ],
    },
  },
  "sf-p0:B2:CE:004": {
    titre: "Notice locative — droits du locataire",
    consigne: "Lisez le texte et indiquez si l'affirmation est vraie ou fausse.",
    contenu: {
      texte: `En France, le bail d'habitation encadre les relations entre propriétaire et locataire. Le locataire dispose d'un droit au logement décent et le bailleur doit entretenir les parties communes et les équipements essentiels. Le propriétaire ne peut pas pénétrer dans le logement sans l'accord du locataire, sauf urgence avérée ou visite annuelle préalablement annoncée par écrit au moins quarante-huit heures à l'avance. Le dépôt de garantie est plafonné à un mois de loyer hors charges pour un bail vide. En cas de vente du bien, le locataire bénéficie d'un droit de préemption dans certaines situations. Le préavis de départ est en principe de trois mois pour un bailleur et d'un mois pour un locataire en zone tendue, sauf accord contraire. Le non-paiement du loyer peut conduire à une procédure devant la commission départementale de conciliation avant toute expulsion. Les aides au logement de la CAF peuvent réduire le reste à charge du locataire. Toute augmentation de loyer hors révision annuelle encadrée est interdite pendant la durée du bail.`,
      items: [
        {
          question: "Le propriétaire peut entrer dans le logement à tout moment sans prévenir le locataire.",
          bonne_reponse: "faux",
          explication: "Le texte exige un accord ou une visite annoncée quarante-huit heures à l'avance.",
        },
      ],
    },
  },
  "sf-p0:B2:CE:005": {
    titre: "Formulaire CAF — compléter une information",
    consigne: "Lisez le document et complétez la lacune.",
    contenu: {
      texte: `Avis aux allocataires de la Caisse d'allocations familiales

Vous avez déclaré un changement de situation professionnelle le 3 mai 2026. Conformément à la réglementation, vous devez transmettre votre attestation employeur et votre dernier avis d'imposition avant le 20 mai 2026. Le traitement de votre dossier nécessite une vérification de vos ressources sur les douze derniers mois. Si les pièces manquent, vos droits aux aides au logement pourraient être suspendus provisoirement. Vous pouvez déposer vos documents sur votre espace personnel caf.fr ou les envoyer par courrier recommandé à votre centre de gestion. En cas de difficulté, un travailleur social peut vous accompagner sur rendez-vous. Le délai moyen de traitement est de quinze jours ouvrés après réception complète du dossier. Pour toute question, contactez le 3230 du lundi au vendredi. Cette démarche s'inscrit dans le cadre de la lutte contre la fraude et garantit une attribution équitable des prestations. Nous vous remercions de votre coopération.`,
      items: [
        {
          question: "Complétez : Le délai moyen de traitement est de ___ après réception complète du dossier.",
          bonne_reponse: "quinze jours ouvrés",
          explication: "Le document indique quinze jours ouvrés.",
        },
      ],
    },
  },
};

export function buildDeterministicExercise(slot) {
  const template = DETERMINISTIC_TEMPLATES[slot.metadata_code];
  if (!template) {
    throw new Error(`Gabarit déterministe absent pour ${slot.metadata_code}`);
  }
  return finalizeDraftExercise(slot, template, { generationMode: "deterministic" });
}

export function summarizeManifest(entries) {
  const valid = entries.filter((e) => e.validation?.ok && e.checks?.allOk).length;
  const invalid = entries.length - valid;
  const themes = [...new Set(entries.map((e) => e.draft.theme))];
  const formats = entries.reduce((acc, e) => {
    acc[e.draft.format] = (acc[e.draft.format] ?? 0) + 1;
    return acc;
  }, {});

  return {
    planned: entries.length,
    valid,
    invalid,
    distinct_themes: themes.length,
    themes,
    formats,
    db_writes: 0,
  };
}
