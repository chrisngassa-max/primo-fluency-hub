/**
 * apply-lot8-b2-ce.mjs — Application contrôlée Lot 8 B2 CE (5 exercices).
 *
 * Sans --apply : dry-run read-only (vérif doublons metadata_code + revalidation locale).
 * Avec --apply : insert dans public.exercices uniquement (jamais session_exercices).
 *
 * USAGE :
 *   node --import tsx scripts/apply-lot8-b2-ce.mjs
 *   node --import tsx scripts/apply-lot8-b2-ce.mjs --manifest path/to/revalidated.json
 *   node --import tsx scripts/apply-lot8-b2-ce.mjs --apply   # écriture DB — GO humain requis
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  LOT8_B2_CE_SLOTS,
  checkEntryConstraints,
  countWords,
} from "./lib/lot8-b2-ce-spec.mjs";
import {
  runValidationChain,
  groupIssuesByCode,
} from "../supabase/functions/_shared/validation-chain.ts";
import { hasUsableContent } from "../supabase/functions/_shared/exercise-search.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const EXPECTED_CODES = LOT8_B2_CE_SLOTS.map((s) => s.metadata_code);
/** Score réutilisation P0 — bypass EXCL_09 titre_sejour sur B2 (≥ REUSE_SCORE_MIN). */
const LOT8_P0_REUSE_SCORE = 85;
const GLOBAL_FORBIDDEN_CODES = new Set([
  "missing_ce_text",
  "correction_not_in_text",
  "qcm_no_options",
  "qcm_answer_not_in_options",
]);

async function loadEnvLocal() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const raw = await readFile(resolve(ROOT, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local absent
  }
}

function parseArgs(argv) {
  const args = { apply: false, manifest: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") args.apply = true;
    if (arg === "--manifest" && argv[i + 1]) args.manifest = resolve(argv[++i]);
  }
  return args;
}


async function resolveLatestRevalidatedManifest() {
  const { readdir } = await import("node:fs/promises");
  const backupsDir = resolve(ROOT, "scripts", "backups");
  const dirs = (await readdir(backupsDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && d.name.startsWith("lot8-b2-ce-revalidated-"))
    .map((d) => d.name)
    .sort()
    .reverse();

  if (dirs.length === 0) {
    throw new Error(
      "Aucun manifest revalidé trouvé. Exécuter d'abord : node --import tsx scripts/revalidate-lot8-b2-ce.mjs",
    );
  }

  const folder = dirs[0];
  const slug = folder.replace("lot8-b2-ce-revalidated-", "");
  return resolve(backupsDir, folder, `lot8-b2-ce-revalidated-${slug}.json`);
}

async function validateDraft(draft) {
  const validation = await runValidationChain(
    { id: draft.metadata_code, ...draft },
    {
      profile: "generated_strict",
      context: { targetNiveauVise: "B2", targetThemeId: draft.theme },
    },
  );

  return {
    ok: validation.ok,
    status: validation.status,
    hasUsableContent: hasUsableContent(draft),
    issues: validation.issues,
    issue_codes: groupIssuesByCode(validation.issues),
    layers: validation.layers,
    flags: validation.flags,
    checkedAt: validation.checkedAt,
    structuralScore: validation.structuralScore,
  };
}

function hasGlobalForbiddenCode(validation) {
  return validation.issues.some(
    (i) => GLOBAL_FORBIDDEN_CODES.has(i.code) && i.severity === "error",
  );
}

async function resolveApplyContext(client) {
  const formateurId = process.env.SF_P0_FORMATEUR_ID ?? process.env.CURRICULUM_BRIDGE_FORMATEUR_ID;
  const pointId = process.env.SF_P0_POINT_ID ?? process.env.CURRICULUM_BRIDGE_POINT_ID;

  let resolvedFormateur = formateurId;
  if (!resolvedFormateur) {
    const { data: roleRow, error } = await client
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Lecture user_roles : ${error.message}`);
    if (!roleRow?.user_id) {
      throw new Error("SF_P0_FORMATEUR_ID absent et aucun admin trouvé.");
    }
    resolvedFormateur = roleRow.user_id;
  }

  let resolvedPoint = pointId;
  if (!resolvedPoint) {
    const { data, error } = await client
      .from("points_a_maitriser")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Lecture points_a_maitriser : ${error.message}`);
    if (!data?.id) throw new Error("SF_P0_POINT_ID absent et aucun point_a_maitriser trouvé.");
    resolvedPoint = data.id;
  }

  return { formateurId: resolvedFormateur, pointId: resolvedPoint };
}

function draftToInsertRow(draft, validation, { formateurId, pointId }) {
  const timeLimit = draft.contenu?.metadata?.time_limit_seconds ?? null;
  return {
    formateur_id: formateurId,
    point_a_maitriser_id: pointId,
    titre: draft.titre,
    consigne: draft.consigne,
    competence: draft.competence,
    format: draft.format,
    niveau_vise: draft.niveau_vise,
    difficulte: draft.difficulte,
    contexte_irn: draft.contexte_irn,
    theme: draft.theme,
    source: draft.source,
    metadata_code: draft.metadata_code,
    objectif_tcf: draft.objectif_tcf,
    niveau_guidage: draft.niveau_guidage,
    is_ai_generated: draft.is_ai_generated ?? false,
    is_template: draft.is_template ?? false,
    is_devoir: draft.is_devoir ?? false,
    contenu: draft.contenu,
    duree_limite_secondes: timeLimit,
    validation_status: validation.status,
    validation_score: validation.structuralScore ?? LOT8_P0_REUSE_SCORE,
    validation_issues: validation.issues,
    validation_checked_at: validation.checkedAt,
    validation_profile: "generated_strict",
    validation_source: "lot8_p0_apply",
  };
}

async function checkDuplicateMetadataCodes(client, codes) {
  const { data, error } = await client
    .from("exercices")
    .select("id, metadata_code, titre, competence, niveau_vise")
    .in("metadata_code", codes);

  if (error) throw new Error(`Lecture exercices (read-only) : ${error.message}`);
  return data ?? [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadEnvLocal();

  const manifestPath = args.manifest ?? (await resolveLatestRevalidatedManifest());
  const raw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);

  if (!Array.isArray(manifest.entries) || manifest.entries.length !== 5) {
    throw new Error(`Manifest invalide : attendu 5 entrées, reçu ${manifest.entries?.length ?? 0}`);
  }

  const codes = manifest.entries.map((e) => e.metadata_code).sort();
  const expected = [...EXPECTED_CODES].sort();
  if (JSON.stringify(codes) !== JSON.stringify(expected)) {
    throw new Error(`metadata_code inattendus : ${codes.join(", ")}`);
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Variables requises : SUPABASE_URL (ou VITE_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Lot 8 B2 CE apply — mode ${args.apply ? "APPLY" : "dry-run"}\n`);
  console.log(`  manifest : ${manifestPath}`);

  const duplicates = await checkDuplicateMetadataCodes(supabase, EXPECTED_CODES);
  if (duplicates.length > 0) {
    console.error("\nNO-GO : metadata_code déjà présents en base :");
    for (const row of duplicates) {
      console.error(`  - ${row.metadata_code} (id=${row.id}, ${row.titre})`);
    }
    process.exit(1);
  }
  console.log(`  doublons metadata_code : 0/${EXPECTED_CODES.length} (read-only OK)`);

  const prepared = [];
  for (const entry of manifest.entries) {
    const draft = entry.draft;
    const validation = await validateDraft(draft);
    const checks = checkEntryConstraints(draft, validation);

    const blockers = [];
    if (validation.status === "rejected") blockers.push("status=rejected");
    if (hasGlobalForbiddenCode(validation)) {
      blockers.push(
        `codes interdits : ${validation.issues
          .filter((i) => GLOBAL_FORBIDDEN_CODES.has(i.code))
          .map((i) => i.code)
          .join(", ")}`,
      );
    }
    if (!checks.allOk) blockers.push(`checks=${JSON.stringify(checks)}`);
    if (validation.status !== "validated_auto") blockers.push(`status=${validation.status}`);

    prepared.push({ entry, draft, validation, checks, blockers });
  }

  console.log(`  inserts planifiés : ${prepared.length}/5`);

  let hasBlockers = false;
  for (const row of prepared) {
    const ok = row.blockers.length === 0;
    const icon = ok ? "✅" : "❌";
    console.log(
      `\n${icon} ${row.draft.metadata_code} — ${row.draft.titre}`,
    );
    console.log(`     status=${row.validation.status} | texte=${countWords(row.draft.contenu?.texte)} mots`);
    console.log(`     consigne (${countWords(row.draft.consigne)} mots) : ${row.draft.consigne}`);
    if (row.blockers.length) {
      hasBlockers = true;
      for (const b of row.blockers) console.log(`     BLOQUANT : ${b}`);
    }
  }

  if (hasBlockers) {
    console.error("\nNO-GO : au moins un exercice bloqué.");
    process.exit(1);
  }

  if (!args.apply) {
    console.log("\n── Dry-run terminé ──");
    console.log("  0 écriture Supabase (lecture doublons uniquement).");
    console.log("  Relancer avec --apply après GO humain explicite.");
    return;
  }

  const { formateurId, pointId } = await resolveApplyContext(supabase);
  const rows = prepared.map(({ draft, validation }) =>
    draftToInsertRow(draft, validation, { formateurId, pointId }),
  );

  const { data, error } = await supabase.from("exercices").insert(rows).select("id, metadata_code");
  if (error) {
    console.error("Échec insert exercices :", error.message);
    process.exit(1);
  }

  console.log(`\nAppliqué : ${data?.length ?? 0} insert(s) dans exercices.`);
  for (const row of data ?? []) {
    console.log(`  - ${row.metadata_code} → id=${row.id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
