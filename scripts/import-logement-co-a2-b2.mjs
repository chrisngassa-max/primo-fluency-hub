import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const corpusPath = resolve("data/corpora/logement-co-a2-b2.json");
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const formateurId = process.env.FORMATEUR_ID;
const pointAMaitriserId = process.env.POINT_A_MAITRISER_ID;

const raw = await readFile(corpusPath, "utf8");
const corpus = JSON.parse(raw);

if (!Array.isArray(corpus)) {
  throw new Error(`Expected array in ${corpusPath}`);
}

function assertValidExercise(ex) {
  const errors = [];
  if (ex.competence && ex.competence !== "CO") errors.push("competence_must_be_co");
  if (!["A2", "B1", "B2"].includes(ex.niveau_vise)) errors.push("niveau_must_be_a2_b1_or_b2");
  if (!ex.script_audio || ex.script_audio.split(/\s+/).length < 25) errors.push("script_audio_too_short");
  if (!Array.isArray(ex.items) || ex.items.length === 0) errors.push("items_required");
  for (const [index, item] of (ex.items ?? []).entries()) {
    if (!Array.isArray(item.options) || !item.options.includes(item.bonne_reponse)) {
      errors.push(`item_${index}_answer_not_in_options`);
    }
  }
  if (errors.length) throw new Error(`${ex.code}: ${errors.join(", ")}`);
}

for (const exercise of corpus) assertValidExercise(exercise);

const byLevel = corpus.reduce((acc, ex) => {
  acc[ex.niveau_vise] = (acc[ex.niveau_vise] ?? 0) + 1;
  return acc;
}, {});

if (dryRun) {
  console.log(`Dry run OK: ${corpus.length} logement CO A2/B2 exercises parsed.`);
  console.table(byLevel);
  process.exit(0);
}

if (!supabaseUrl || !serviceRoleKey || !formateurId || !pointAMaitriserId) {
  console.error("Missing required environment variables.");
  console.error("Required: SUPABASE_URL or VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FORMATEUR_ID, POINT_A_MAITRISER_ID.");
  console.error("Dry run: node scripts/import-logement-co-a2-b2.mjs --dry-run");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rows = corpus.map((ex) => ({
  formateur_id: formateurId,
  point_a_maitriser_id: pointAMaitriserId,
  titre: ex.titre,
  consigne: ex.consigne,
  competence: "CO",
  format: "qcm",
  difficulte: ex.difficulte,
  niveau_vise: ex.niveau_vise,
  contexte_irn: ex.contexte_irn,
  sous_competence: ex.sous_competence,
  contenu: {
    corpus_code: ex.code,
    script_audio: ex.script_audio,
    items: ex.items,
  },
  is_template: true,
  is_ai_generated: false,
  is_devoir: false,
  theme: "logement",
  niveau_guidage: ex.niveau_guidage,
  outils_aide: ex.outils_aide,
  duree_estimee_min: ex.duree_estimee_min,
  autonomie_requise: ex.autonomie_requise,
  objectif_tcf: ex.objectif_tcf,
  regle_montee_auto: true,
}));

const { error } = await supabase.from("exercices").insert(rows);
if (error) {
  console.error(error);
  process.exit(1);
}

console.log(`Imported ${rows.length} logement CO A2/B2 exercises.`);
