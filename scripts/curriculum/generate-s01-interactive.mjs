import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_PATH = join(ROOT, "content", "curriculum", "v2", "S01-v3", "s01-v3-data.json");
const OUTPUT_PATH = join(ROOT, "content", "curriculum", "v2", "S01-v3", "exercices-interactifs.json");
const LEVELS = ["A1", "A2", "B1", "B2"];
const SUPPORTED_FORMATS = new Set(["qcm", "vrai_faux", "appariement", "production_ecrite", "production_orale", "texte_lacunaire", "transformation"]);

function itemFrom(source) {
  return {
    question: source.question ?? source.enonce ?? source.prompt ?? "",
    options: source.options,
    bonne_reponse: source.reponse ?? source.bonne_reponse ?? "",
    explication: source.justification ?? source.criteres ?? undefined,
  };
}

export function mapGrammarPointItems(point) {
  const questions = Array.isArray(point?.items) ? point.items : [];
  const answers = Array.isArray(point?.reponses) ? point.reponses : [];

  if (questions.length !== answers.length) {
    throw new Error(
      `Structures "${point?.point ?? "sans titre"}" : ${questions.length} question(s) pour ${answers.length} reponse(s).`,
    );
  }

  return questions.map((question, index) => ({
    question,
    bonne_reponse: answers[index],
    explication: point.point,
  }));
}

function exercise({ code, title, competence, format, level, instruction, items, source, duration = 420, familyId = null, extensionOf = null }) {
  if (!SUPPORTED_FORMATS.has(format)) throw new Error(`Format non supporté: ${format}`);
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
    contenu: {
      items,
      metadata: {
        session_code: "S01",
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
      },
    },
  };
}

export async function buildInteractiveS01() {
  const data = JSON.parse(await readFile(DATA_PATH, "utf8"));
  const exercises = [];

  for (const level of LEVELS) {
    const coQuestionIds = {
      A1: [1, 3, 4, 5],
      A2: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      B1: [2, 6, 7, 8, 9, 10],
      B2: [2, 7, 8, 9, 10],
    }[level];
    const coItems = data.qcm_tcf.questions
      .filter((question) => coQuestionIds.includes(question.id))
      .map((question) => ({
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
    }));

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
      items: grammarPoints.flatMap(mapGrammarPointItems),
      source: grammarPoints.map((point) => point.source).join(" | "),
      duration: 420,
    }));

    const oralPrompts = data.eo_prompts.filter((prompt) => prompt.niveau === level);
    exercises.push(exercise({
      code: "eo",
      title: `Prendre la parole — ${level}`,
      competence: "EO",
      format: "production_orale",
      level,
      instruction: "Enregistrez vos réponses. Vous pourrez réécouter la transcription et le corrigé oral.",
      items: oralPrompts.map(itemFrom),
      source: oralPrompts.map((p) => p.source).join(" | "),
      duration: 480,
      extensionOf: "S01_CO_ACCUEIL_01",
    }));
  }

  exercises.push(exercise({
    code: "civique",
    title: "Droits, devoirs et règles",
    competence: "CE",
    format: "qcm",
    level: "A2",
    instruction: "Lisez chaque situation puis choisissez la réponse directement justifiée par la règle présentée.",
    items: data.qcm_civique.questions.map(itemFrom),
    source: data.qcm_civique.resource_id,
    duration: 600,
  }));

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
    }));
  }

  const playlists = Object.fromEntries(LEVELS.map((level) => {
    const selected = exercises.filter((entry) => entry.niveau_vise === level);
    return [level, selected.map((entry, index) => ({
      ordre: index + 1,
      metadata_code: entry.metadata_code,
      label: `Activité ${index + 1} sur ${selected.length}`,
      trainer_preview_required: true,
    }))];
  }));

  const report = {
    generated_at: "2026-07-12",
    session_code: "S01",
    pivot_level: "A2",
    exercise_count: exercises.length,
    counts_by_level: Object.fromEntries(LEVELS.map((level) => [level, exercises.filter((entry) => entry.niveau_vise === level).length])),
    counts_by_competence: Object.fromEntries(["CO", "CE", "EE", "EO", "Structures"].map((competence) => [competence, exercises.filter((entry) => entry.competence === competence).length])),
    validation_rules: [
      { rule_id: "INTERACTIVE_FORMAT_SUPPORTED", status: exercises.every((entry) => SUPPORTED_FORMATS.has(entry.format)) ? "pass" : "fail" },
      { rule_id: "MINIMUM_FOUR_ACTIVITIES_PER_LEVEL", status: LEVELS.every((level) => playlists[level].length >= 4) ? "pass" : "fail" },
      { rule_id: "TRAINER_PREVIEW_REQUIRED", status: exercises.every((entry) => entry.contenu.metadata.trainer_preview_required) ? "pass" : "fail" },
      { rule_id: "COMPETENCE_FAMILY_PRESERVED", status: exercises.filter((entry) => entry.family_id).every((entry) => entry.competence === (entry.family_id.includes("_CO_") ? "CO" : entry.competence)) ? "pass" : "fail" },
    ],
    warnings: [
      "Le MP3 définitif reste à produire avec une voix réelle.",
      "Les affirmations civiques doivent être validées contre la base officielle versionnée avant publication.",
      "Le chronométrage doit être calibré avec des données terrain.",
    ],
  };

  const payload = { schema_version: "1.0", session_code: "S01", exercises, playlists, report };
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return payload;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const payload = await buildInteractiveS01();
  console.log(`S01 interactive: ${payload.exercises.length} exercices générés dans ${OUTPUT_PATH}`);
  console.log(JSON.stringify(payload.report, null, 2));
}
