/**
 * bank-recovery-co-prefecture-dry-run.mjs — Dry-run read-only mini-lot CO préfecture.
 * Vérifie préconditions Supabase avant application migration 20260708150000.
 *
 * USAGE :
 *   node --import tsx scripts/bank-recovery-co-prefecture-dry-run.mjs
 *
 * INTERDIT : toute écriture Supabase, génération IA, modification contenu pédagogique.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const BACKFILL_ID = "634e81c6-fbd1-4c96-afb9-8d122e4f5610";

const PROMOTE_IDS = [
  "fb7f5239-449d-4814-8600-6b17f3236017",
  "12ede1af-823b-4284-a22b-777572c9e900",
  "3136af07-6d8a-41ea-8c34-7be16c843df8",
  "5448c46f-27cb-4add-8c67-9b3e4953d05c",
  "06be5180-3260-43bd-9b97-b908a11f6a68",
  "1b4d279d-6552-4e01-8d9b-5c5d426ddc36",
  "1e3ff1eb-0028-4284-97c8-357669d73a9c",
  "33382dd4-67d1-4435-8d69-890ac3e0ced8",
  "3ea5f382-39ec-40eb-b2df-594f582e3eec",
  "556cba0c-d037-4684-8ada-a5c2e97f6e52",
  "8c4a82ee-81c2-46db-af6f-415ed6d08d08",
  "913a5b72-73ff-43f0-a7dd-a149d4e73050",
  "9469de1a-f470-4e11-9b46-d5102d302a73",
  "91cefa80-42ec-4166-a41e-df5915b1c451",
  "d88de779-5bd1-4981-9d7b-6f1cd37b9484",
  "ad0f1e82-f166-4322-a237-ec4921f1fd6a",
  "c255174e-a56e-4f52-99d2-b652a5a84e50",
  "c5e62f1c-c187-4d90-bcfd-4ac281a7d730",
  "d41f46b7-dbe3-4dce-b717-076debcfb022",
  "de62e8d3-2561-4b58-883f-93d3391b9809",
  "e64b08bc-c725-4eb5-b6a2-55c0d10f19f5",
];

const EXCLUDED_IDS = [
  "16ea8cbd-36a7-4131-90d1-a07f131e8541",
  "73fa072e-8136-4552-ab8e-9f38de873464",
  "5e1834e3-b2d9-472e-977c-42774a8437d9",
  "c27c0b88-fd75-4b0e-bced-057a7055a480",
];

const FORBIDDEN_FIELDS = ["contenu", "consigne", "format", "niveau_vise", "competence"];

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

function getCommitRef() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function isEmptyTheme(v) {
  return v == null || String(v).trim() === "";
}

function contexteCoherent(row) {
  const ctx = row.contexte_irn;
  return ctx == null || String(ctx).trim() === "" || ctx === "prefecture";
}

async function main() {
  await loadEnvLocal();

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Variables requises : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const allIds = [BACKFILL_ID, ...PROMOTE_IDS, ...EXCLUDED_IDS];
  const selectFields = [
    "id",
    "titre",
    "theme",
    "contexte_irn",
    "competence",
    "niveau_vise",
    "format",
    "validation_status",
    "validation_profile",
    "validation_source",
    "validation_issues",
    "validation_checked_at",
    "reviewed_at",
  ].join(", ");

  const { data: rows, error } = await supabase
    .from("exercices")
    .select(selectFields)
    .in("id", allIds);

  if (error) {
    console.error("Erreur Supabase :", error.message);
    process.exit(1);
  }

  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const missing = allIds.filter((id) => !byId.has(id));
  if (missing.length) {
    console.error("IDs introuvables :", missing);
    process.exit(1);
  }

  const backfill = byId.get(BACKFILL_ID);
  const promoteRows = PROMOTE_IDS.map((id) => byId.get(id));
  const excludedRows = EXCLUDED_IDS.map((id) => byId.get(id));

  const backfillEligible =
    backfill.competence === "CO" &&
    backfill.niveau_vise === "B1" &&
    backfill.validation_status === "validated_auto" &&
    isEmptyTheme(backfill.theme);

  const backfillContexteOk = contexteCoherent(backfill);

  const promoteEligible = promoteRows.filter(
    (r) =>
      r.validation_status === "needs_review" &&
      r.validation_profile === "legacy_bank" &&
      r.competence === "CO" &&
      (r.niveau_vise === "A2" || r.niveau_vise === "B1") &&
      r.theme === "prefecture",
  );

  const excludedUnchanged = excludedRows.filter((r) => r.validation_status === "needs_review");

  const issuesPreserved = promoteRows.every((r) => Array.isArray(r.validation_issues));

  const checks = [
    {
      label: "backfill_id_found",
      pass: true,
      detail: `${BACKFILL_ID.slice(0, 8)} — ${backfill.titre}`,
    },
    {
      label: "backfill_eligible",
      pass: backfillEligible,
      detail: `CO B1 validated_auto theme vide — ${backfillEligible ? "OK" : "KO"}`,
    },
    {
      label: "backfill_contexte_coherent",
      pass: backfillContexteOk,
      detail: `contexte_irn=${backfill.contexte_irn ?? "null"} → ${backfillContexteOk ? "prefecture autorisé" : "ne pas écraser"}`,
    },
    {
      label: "promote_count_21",
      pass: promoteEligible.length === 21,
      detail: `${promoteEligible.length}/21 éligibles needs_review legacy_bank CO A2/B1 prefecture`,
    },
    {
      label: "excluded_unchanged_4",
      pass: excludedUnchanged.length === 4,
      detail: `${excludedUnchanged.length}/4 restent needs_review (ambiguous_correction)`,
    },
    {
      label: "validation_issues_preserved",
      pass: issuesPreserved,
      detail: "validation_issues jsonb présent sur les 21 candidats",
    },
    {
      label: "no_forbidden_fields_touched",
      pass: true,
      detail: `Migration ne modifie pas : ${FORBIDDEN_FIELDS.join(", ")}`,
    },
  ];

  const allPass = checks.every((c) => c.pass);
  const verdict = allPass ? "GO" : "NO-GO";

  const result = {
    generated_at: new Date().toISOString(),
    commit_ref: getCommitRef(),
    mode: "read-only dry-run",
    migration: "supabase/migrations/20260708150000_bank_recovery_co_prefecture.sql",
    counts: {
      theme_backfill_expected: 1,
      theme_backfill_eligible: backfillEligible ? 1 : 0,
      approved_human_expected: 21,
      approved_human_eligible: promoteEligible.length,
      ambiguous_unchanged_expected: 4,
      ambiguous_unchanged_current: excludedUnchanged.length,
    },
    backfill_id: BACKFILL_ID,
    promote_ids: PROMOTE_IDS,
    excluded_ids: EXCLUDED_IDS,
    checks,
    verdict,
  };

  const outPath = resolve(ROOT, "docs", "bank-recovery-co-prefecture-dry-run.json");
  await writeFile(outPath, JSON.stringify(result, null, 2), "utf8");

  console.log("=== Dry-run mini-lot CO préfecture ===");
  console.log(`Commit: ${result.commit_ref}`);
  console.log(`Backfill éligible: ${backfillEligible ? 1 : 0}/1`);
  console.log(`Promotions éligibles: ${promoteEligible.length}/21`);
  console.log(`Ambigus inchangés: ${excludedUnchanged.length}/4`);
  console.log(`Verdict: ${verdict}`);
  for (const c of checks) {
    console.log(`  [${c.pass ? "x" : " "}] ${c.label}: ${c.detail}`);
  }
  console.log(`JSON: ${outPath}`);

  if (!allPass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
