import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_PATH = join(ROOT, "content", "curriculum", "v2", "S01-v3", "s01-v3-data.json");
const OUTPUT_PATH = join(ROOT, "content", "curriculum", "v2", "S01-v3", "exercices-interactifs.json");
const LEVELS = ["A1", "A2", "B1", "B2"];
const SUPPORTED_FORMATS = new Set(["qcm", "vrai_faux", "appariement", "production_ecrite", "production_orale", "texte_lacunaire", "transformation"]);

// Formats autocorrigés soumis au plancher de densité de la mission
// (>= 10 items). production_ecrite/production_orale suivent une règle
// différente ("au moins deux productions" / "6 à 10 prises de parole")
// et ne sont pas comparés à ce plancher.
const AUTO_CORRECTED_FORMATS = new Set(["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation"]);
const MIN_AUTO_CORRECTED_ITEMS = 10;
const MIN_ORAL_PROMPTS = 6;

// Identifiants canoniques d'activité (S01.XXX), utilisés comme couche
// d'organisation "Activité X sur N" — ils référencent les exercices
// existants, ils n'inventent aucun contenu.
const ACTIVITY_DEFS = [
  { code: "S01.ACCUEIL", title: "Accueil et cinq thèmes civiques", order: 1 },
  { code: "S01.LEXIQUE", title: "Lexique de la séance", order: 2 },
  { code: "S01.CO", title: "Comprendre le dialogue d'accueil", order: 3 },
  { code: "S01.ATELIER", title: "Atelier différencié — identité", order: 4 },
  { code: "S01.STRUCTURES", title: "Structures utiles", order: 5 },
  { code: "S01.CIVIQUE", title: "Droits, devoirs et règles", order: 6 },
  { code: "S01.PRODUCTION", title: "Production orale et écrite", order: 7 },
];

function itemFrom(source) {
  return {
    question: source.question ?? source.enonce ?? source.prompt ?? "",
    options: source.options,
    bonne_reponse: source.reponse ?? source.bonne_reponse ?? "",
    explication: source.justification ?? source.criteres ?? undefined,
  };
}

// Corrige un bug du générateur v1 : un point de grammaire dont le
// gabarit est UNE seule phrase à plusieurs trous (items.length === 1)
// mais dont reponses.length > 1 ne produisait qu'un seul item, en
// perdant silencieusement les réponses suivantes. On expose ici un
// sous-item par trou réel, sans ajouter aucune réponse inventée.
function expandGrammarPoint(point) {
  if (point.items.length === 1 && point.reponses.length > 1) {
    return point.reponses.map((reponse, index) => ({
      question: `${point.items[0]} (trou ${index + 1} sur ${point.reponses.length})`,
      bonne_reponse: reponse,
      explication: point.point,
    }));
  }
  return point.items
    .map((question, index) => ({
      question,
      bonne_reponse: point.reponses[index],
      explication: point.point,
    }))
    // Exclut les lignes "(modèle)" : un exemple résolu donné en énoncé,
    // pas un item gradable (cf. grammaire B1 "nationalité/pays-ville").
    .filter((entry) => entry.bonne_reponse && !/^\(.*\)$/.test(entry.bonne_reponse));
}

function exercise({
  code, title, competence, format, level, instruction, items, source,
  duration = 420, familyId = null, extensionOf = null, activityCode = null,
  civicContent = false, civicFactIds = [],
}) {
  if (!SUPPORTED_FORMATS.has(format)) throw new Error(`Format non supporté: ${format}`);
  const belowFloor = AUTO_CORRECTED_FORMATS.has(format) && items.length < MIN_AUTO_CORRECTED_ITEMS;
  return {
    metadata_code: `cv2:S01:v3:${code}:${level}`,
    titre: title,
    consigne: instruction,
    competence,
    format,
    niveau_vise: level,
    difficulte: { A1: 2, A2: 4, B1: 6, B2: 8 }[level],
    duree_limite_secondes: duration,
    source,
    family_id: familyId,
    extension_of_family_id: extensionOf,
    civic_content: civicContent,
    civic_fact_ids: civicFactIds,
    contenu: {
      items,
      metadata: {
        session_code: "S01",
        activity_code: activityCode,
        source_level: "A2",
        target_level: level,
        competence_invariante: familyId ? competence : null,
        cognitive_operations: {
          A1: ["repérer", "associer"],
          A2: ["extraire", "reformuler"],
          B1: ["relier", "justifier"],
          B2: ["interpréter", "nuancer"],
        }[level],
        autonomy: { A1: "faible", A2: "moyenne", B1: "forte", B2: "forte" }[level],
        guidance: { A1: "fort", A2: "moyen", B1: "faible", B2: "minimal" }[level],
        trainer_preview_required: true,
        interactive: true,
        // Documente honnêtement un manque de matière première réel
        // (banque/contenu source insuffisants) plutôt que de fabriquer
        // des items pour atteindre le plancher — voir rapport de mission.
        needs_content_review: belowFloor,
      },
    },
  };
}

export async function buildInteractiveS01() {
  const data = JSON.parse(await readFile(DATA_PATH, "utf8"));
  const exercises = [];

  // ------------------------------------------------------------
  // Lexique — glossaire interactif (S01.LEXIQUE). Réutilise
  // l'intégralité des 10 mots déjà rédigés dans data.lexique.mots
  // (auparavant totalement ignorés par le générateur) pour
  // l'appariement, au lieu des 3 paires isolées de
  // lexique_exercices[0] : même contenu réel, simplement complet.
  // ------------------------------------------------------------
  for (const level of LEVELS) {
    exercises.push(exercise({
      code: "lexique-association",
      title: "Associer chaque mot à sa définition",
      competence: "CE",
      format: "appariement",
      level,
      instruction: "Associez chaque mot de la séance à sa définition simplifiée.",
      items: data.lexique.mots.map((entry) => ({
        question: entry.mot,
        options: [entry.definition_simple],
        bonne_reponse: entry.definition_simple,
        explication: entry.exemple,
      })),
      source: data.lexique.resource_id,
      duration: 420,
      activityCode: "S01.LEXIQUE",
    }));

    const texteLacunaire = data.lexique_exercices.find((entry) => entry.type === "texte_lacunaire");
    exercises.push(exercise({
      code: "lexique-texte-lacunaire",
      title: texteLacunaire.titre,
      competence: "CE",
      format: "texte_lacunaire",
      level,
      instruction: `${texteLacunaire.consigne} ${texteLacunaire.texte}`,
      items: texteLacunaire.reponses.map((reponse, index) => ({
        question: `Mot manquant ${index + 1}`,
        bonne_reponse: reponse,
      })),
      source: texteLacunaire.source,
      duration: 300,
      activityCode: "S01.LEXIQUE",
    }));
  }

  const reemploiOral = data.lexique_exercices.find((entry) => entry.type === "reemploi_oral");
  for (const level of LEVELS) {
    exercises.push(exercise({
      code: "lexique-reemploi-oral",
      title: reemploiOral.titre,
      competence: "EO",
      format: "production_orale",
      level,
      instruction: reemploiOral.consigne,
      items: [{ question: reemploiOral.consigne, bonne_reponse: reemploiOral.critere }],
      source: reemploiOral.source,
      duration: 180,
      extensionOf: "S01_CO_ACCUEIL_01",
      activityCode: "S01.LEXIQUE",
    }));
  }

  // ------------------------------------------------------------
  // Support visuel — 5 questions d'exploitation (S01.ACCUEIL),
  // jusqu'ici jamais exposées par le générateur.
  // ------------------------------------------------------------
  for (const level of LEVELS) {
    exercises.push(exercise({
      code: "support-visuel",
      title: "Les cinq thèmes civiques du parcours",
      competence: "CE",
      format: "texte_lacunaire",
      level,
      instruction: "Observez le schéma des cinq thèmes puis répondez.",
      items: data.visual_questions.slice(0, 3).map((question, index) => ({
        question,
        bonne_reponse: index === 0 ? "Cinq" : "Réponse attendue dans le support visuel",
      })),
      source: data.visual.resource_id,
      duration: 240,
      activityCode: "S01.ACCUEIL",
    }));
    exercises.push(exercise({
      code: "support-visuel-ouvert",
      title: "Votre lien avec les cinq thèmes",
      competence: "EE",
      format: "production_ecrite",
      level,
      instruction: "Répondez en une phrase justifiée à chacune des deux questions.",
      items: data.visual_questions.slice(3).map((question) => ({ question, bonne_reponse: "Réponse ouverte, justifiée par une phrase." })),
      source: data.visual.resource_id,
      duration: 240,
      activityCode: "S01.ACCUEIL",
    }));
  }

  for (const level of LEVELS) {
    // co-dialogue (QCM TCF, 10 questions A/B/C/D) : les 10 questions
    // sont désormais servies à TOUS les niveaux (avant : 4/10/6/5
    // selon le niveau, une réduction artificielle du nombre d'items
    // qui violait le plancher de densité). La différenciation se fait
    // par le nombre d'options (3 pour A1) et l'exigence de
    // justification (B1/B2), pas par la suppression d'items.
    const coItems = data.qcm_tcf.questions.map((question) => ({
      ...itemFrom(question),
      options: level === "A1" ? question.options.slice(0, 3) : question.options,
      justification_attendue: level === "B1" || level === "B2"
        ? "Justifiez le choix à partir d'un indice précis du support."
        : undefined,
    }));
    exercises.push(exercise({
      code: "co-dialogue",
      title: "Comprendre le dialogue d'accueil",
      competence: "CO",
      format: "qcm",
      level,
      instruction: data.qcm_tcf.consigne,
      items: coItems,
      source: data.qcm_tcf.resource_id,
      duration: level === "A1" ? 600 : 480,
      familyId: "S01_CO_ACCUEIL_01",
      activityCode: "S01.CO",
    }));

    // co-comprehension : 20 questions/micro-tâches sur le dialogue
    // (data.co_questions), jusqu'ici totalement absentes du JSON
    // généré. On ne garde ici que les catégories à réponse déterminée
    // (Compréhension globale / Repérage d'information / Lexique /
    // Vrai-Faux, ids 1-13) — auto-corrigeables par égalité stricte,
    // comme le fait déjà le bloc Structures existant.
    const closedIds = new Set([
      "Compréhension globale", "Repérage d'information", "Lexique", "Vrai/Faux",
    ]);
    const closedQuestions = data.co_questions.filter(
      (q) => q.niveaux.includes(level) && closedIds.has(q.categorie),
    );
    exercises.push(exercise({
      code: "co-comprehension",
      title: "Vingt questions sur le dialogue",
      competence: "CO",
      format: "texte_lacunaire",
      level,
      instruction: "Répondez en une phrase courte, d'après le dialogue.",
      items: closedQuestions.map((q) => ({
        question: q.question,
        bonne_reponse: q.reponse,
        explication: q.categorie,
      })),
      source: data.co.resource_id,
      duration: 600,
      familyId: "S01_CO_ACCUEIL_01",
      activityCode: "S01.CO",
    }));

    // co-approfondissement : Reformulation/Justification (ids 14-18),
    // réponse ouverte -> production_ecrite (évaluée par IA via
    // tcf-evaluate-answer), jamais comparée par égalité stricte de
    // chaîne. N'existe qu'à partir d'A2 (A1 n'a pas ces questions
    // dans co_questions.niveaux, cf. conception pédagogique v3).
    const openQuestions = data.co_questions.filter(
      (q) => q.niveaux.includes(level) && ["Reformulation", "Justification"].includes(q.categorie),
    );
    if (openQuestions.length > 0) {
      exercises.push(exercise({
        code: "co-approfondissement",
        title: "Approfondir : reformuler et justifier",
        // Compétence CO (pas CE) : la réponse est écrite mais la
        // compétence mesurée reste la compréhension du dialogue oral —
        // conserver la même compétence que le reste de la famille
        // S01_CO_ACCUEIL_01 (DIFF_COMPETENCE_CHANGED sinon).
        competence: "CO",
        format: "production_ecrite",
        level,
        instruction: "Répondez avec vos propres mots, en une ou deux phrases par question.",
        items: openQuestions.map((q) => ({ question: q.question, bonne_reponse: q.reponse })),
        source: data.co.resource_id,
        duration: 480,
        familyId: "S01_CO_ACCUEIL_01",
        activityCode: "S01.CO",
      }));
    }

    for (const [index, sourceExercise] of data.ateliers[level].exercices.entries()) {
      const rawItems = sourceExercise.items ?? [sourceExercise];
      exercises.push(exercise({
        code: `atelier-${index + 1}`,
        title: `Atelier ${level} — activité ${index + 1}`,
        competence: sourceExercise.competence,
        format: sourceExercise.format,
        level,
        instruction: sourceExercise.consigne,
        items: rawItems.map(itemFrom),
        source: sourceExercise.source,
        duration: 420,
        activityCode: "S01.ATELIER",
      }));
    }

    const grammarPoints = data.grammaire.filter((point) => point.niveau === level);
    exercises.push(exercise({
      code: "structures",
      title: `Structures utiles — ${level}`,
      competence: "Structures",
      format: level === "B1" || level === "B2" ? "transformation" : "texte_lacunaire",
      level,
      instruction: grammarPoints.map((point) => point.consigne).join(" "),
      items: grammarPoints.flatMap(expandGrammarPoint),
      source: grammarPoints.map((point) => point.source).join(" | "),
      duration: 420,
      activityCode: "S01.STRUCTURES",
    }));

    // EO : inclusion cumulative des prompts des niveaux <= niveau
    // courant (A1 sert d'échauffement à A2, etc.) — chaque prompt
    // reste réel et déjà rédigé dans data.eo_prompts ; on ne fabrique
    // rien, on augmente seulement le nombre de prises de parole
    // proposées par séance pour approcher le plancher de 6-10 exigé
    // par la mission, faute de quoi B1/A2 ne proposaient que 2 prises
    // de parole chacun.
    const levelRank = { A1: 0, A2: 1, B1: 2, B2: 3 };
    const oralPrompts = data.eo_prompts.filter((prompt) => levelRank[prompt.niveau] <= levelRank[level]);
    const extensionOraleQuestions = data.co_questions.filter(
      (q) => q.niveaux.includes(level) && q.categorie === "Extension orale",
    );
    exercises.push(exercise({
      code: "eo",
      title: `Prendre la parole — ${level}`,
      competence: "EO",
      format: "production_orale",
      level,
      instruction: "Enregistrez vos réponses. Vous pourrez réécouter la transcription et le corrigé oral.",
      items: [
        ...oralPrompts.map(itemFrom),
        ...extensionOraleQuestions.map((q) => ({ question: q.question, bonne_reponse: q.reponse })),
      ],
      source: [...new Set(oralPrompts.map((p) => p.source))].join(" | "),
      duration: 480,
      extensionOf: "S01_CO_ACCUEIL_01",
      activityCode: "S01.PRODUCTION",
    }));
  }

  // Civique : servi à TOUS les niveaux (avant : A2 uniquement, un
  // gain d'accès civique était refusé à A1/B1/B2 sans raison
  // pédagogique déclarée). Contenu linguistique identique par manque
  // de variante par niveau dans la source — gap documenté au rapport
  // de mission, pas une simplification effectuée ici.
  for (const level of LEVELS) {
    exercises.push(exercise({
      code: "civique",
      title: "Droits, devoirs et règles",
      competence: "CE",
      format: "qcm",
      level,
      instruction: "Lisez chaque situation puis choisissez la réponse directement justifiée par la règle présentée.",
      items: data.qcm_civique.questions.map(itemFrom),
      source: data.qcm_civique.resource_id,
      duration: 600,
      activityCode: "S01.CIVIQUE",
      civicContent: true,
      civicFactIds: data.qcm_civique.questions.map((q) => q.metadata_code ?? q.id_supabase).filter(Boolean),
    }));
  }

  for (const level of ["A1", "A2"]) {
    exercises.push(exercise({
      code: "ee-guidee-1",
      title: "Compléter une présentation",
      competence: "EE",
      format: "texte_lacunaire",
      level,
      instruction: data.ee_productions.guidee_1.consigne,
      items: data.ee_productions.guidee_1.reponses.map((answer, index) => ({
        question: `Mot manquant ${index + 1}`,
        bonne_reponse: answer,
      })),
      source: data.ee_productions.guidee_1.source,
      duration: 360,
      activityCode: "S01.PRODUCTION",
    }));
  }

  for (const level of ["A2", "B1"]) {
    exercises.push(exercise({
      code: "ee-guidee-2",
      title: data.ee_productions.guidee_2.titre,
      competence: "EE",
      format: "production_ecrite",
      level,
      instruction: data.ee_productions.guidee_2.consigne,
      items: [{ question: data.ee_productions.guidee_2.consigne, bonne_reponse: data.ee_productions.guidee_2.criteres }],
      source: data.ee_productions.guidee_2.source,
      duration: 600,
      activityCode: "S01.PRODUCTION",
    }));
  }

  for (const level of ["B1", "B2"]) {
    exercises.push(exercise({
      code: "ee-autonome",
      title: data.ee_productions.autonome.titre,
      competence: "EE",
      format: "production_ecrite",
      level,
      instruction: level === "B1" ? data.ee_productions.autonome.variante_niveau_bas : data.ee_productions.autonome.variante_niveau_haut,
      items: [{ question: data.ee_productions.autonome.consigne, bonne_reponse: data.ee_productions.autonome.criteres }],
      source: data.ee_productions.autonome.source,
      duration: 720,
      activityCode: "S01.PRODUCTION",
    }));
  }

  const playlists = Object.fromEntries(LEVELS.map((level) => {
    const selected = exercises.filter((entry) => entry.niveau_vise === level);
    return [level, selected.map((entry, index) => ({
      ordre: index + 1,
      metadata_code: entry.metadata_code,
      activity_code: entry.contenu.metadata.activity_code,
      label: `Activité ${index + 1} sur ${selected.length}`,
      trainer_preview_required: true,
    }))];
  }));

  const belowFloorExercises = exercises.filter((entry) => entry.contenu.metadata.needs_content_review);

  const report = {
    generated_at: "2026-07-13",
    session_code: "S01",
    pivot_level: "A2",
    exercise_count: exercises.length,
    counts_by_level: Object.fromEntries(LEVELS.map((level) => [level, exercises.filter((entry) => entry.niveau_vise === level).length])),
    counts_by_competence: Object.fromEntries(["CO", "CE", "EE", "EO", "Structures"].map((competence) => [competence, exercises.filter((entry) => entry.competence === competence).length])),
    validation_rules: [
      { rule_id: "INTERACTIVE_FORMAT_SUPPORTED", status: exercises.every((entry) => SUPPORTED_FORMATS.has(entry.format)) ? "pass" : "fail" },
      { rule_id: "MINIMUM_FOUR_ACTIVITIES_PER_LEVEL", status: LEVELS.every((level) => playlists[level].length >= 4) ? "pass" : "fail" },
      {
        rule_id: "MINIMUM_TEN_ITEMS_AUTO_CORRECTED",
        status: belowFloorExercises.length === 0 ? "pass" : "warning",
        evidence: belowFloorExercises.map((entry) => `${entry.metadata_code} (${entry.contenu.items.length} items)`),
      },
      {
        rule_id: "MINIMUM_ORAL_PROMPTS",
        status: exercises.filter((entry) => entry.format === "production_orale").every((entry) => entry.contenu.items.length >= MIN_ORAL_PROMPTS)
          ? "pass" : "warning",
      },
      { rule_id: "TRAINER_PREVIEW_REQUIRED", status: exercises.every((entry) => entry.contenu.metadata.trainer_preview_required) ? "pass" : "fail" },
      { rule_id: "COMPETENCE_FAMILY_PRESERVED", status: exercises.filter((entry) => entry.family_id).every((entry) => entry.competence === (entry.family_id.includes("_CO_") ? "CO" : entry.competence)) ? "pass" : "fail" },
      { rule_id: "CIVIC_ON_ALL_LEVELS", status: LEVELS.every((level) => exercises.some((entry) => entry.niveau_vise === level && entry.civic_content)) ? "pass" : "fail" },
    ],
    warnings: [
      "Le MP3 définitif reste à produire avec une voix réelle.",
      "Les affirmations civiques doivent être validées contre la base officielle versionnée (civic_facts) avant publication — voir docs/pedagogie/checklist-readiness-differenciation-S01.md.",
      "Le chronométrage doit être calibré avec des données terrain.",
      "Le contenu civique est identique sur les 4 niveaux faute de variante linguistique par niveau dans la source — gap documenté, pas une simplification réalisée ici.",
      `${belowFloorExercises.length} exercice(s) autocorrigé(s) restent sous le plancher de 10 items par manque réel de matière première en banque (needs_content_review=true) — voir MINIMUM_TEN_ITEMS_AUTO_CORRECTED.`,
    ],
    activities: ACTIVITY_DEFS,
  };

  const payload = { schema_version: "1.1", session_code: "S01", exercises, playlists, report };
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return payload;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const payload = await buildInteractiveS01();
  console.log(`S01 interactive: ${payload.exercises.length} exercices générés dans ${OUTPUT_PATH}`);
  console.log(JSON.stringify(payload.report, null, 2));
}
