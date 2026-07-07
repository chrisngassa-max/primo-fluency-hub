/**
 * backfill-exercices-validation.mjs — Lot 9 phase 2 : persistance validation_status.
 * Lit la banque 621 exercices, exécute runValidationChain (profil legacy_bank uniquement),
 * écrit manifest JSON+MD. --apply met à jour UNIQUEMENT les colonnes validation_*.
 *
 * USAGE :
 *   npm run backfill:validation
 *   node --import tsx scripts/backfill-exercices-validation.mjs --dry-run
 *   node --import tsx scripts/backfill-exercices-validation.mjs --apply
 *
 * INTERDIT : --profile generated_strict (erreur explicite)
 * NE MODIFIE JAMAIS : contenu, consigne, niveau_vise, competence, format, theme
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  runValidationChain,
  groupIssuesByCode,
} from "../supabase/functions/_shared/validation-chain.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const BACKFILL_PROFILE = "legacy_bank";
const FORBIDDEN_PROFILE = "generated_strict";

const VALIDATION_UPDATE_FIELDS = [
  "validation_status",
  "validation_score",
  "validation_issues",
  "validation_checked_at",
  "validation_profile",
  "validation_source",
];

/** Charge .env.local si les variables Supabase ne sont pas déjà définies. */
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
    // .env.local absent — variables doivent être fournies par l'environnement
  }
}

function parseArgs(argv) {
  const args = {
    dryRun: true,
    apply: false,
    outputDir: null,
    limit: null,
    formats: ["json", "md"],
    profile: BACKFILL_PROFILE,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") {
      args.apply = true;
      args.dryRun = false;
    }
    if (arg === "--dry-run") args.dryRun = true;
    if (arg === "--profile" && argv[i + 1]) {
      args.profile = argv[++i];
    }
    if (arg === "--output-dir" && argv[i + 1]) {
      args.outputDir = argv[++i];
    }
    if (arg === "--limit" && argv[i + 1]) {
      args.limit = Number(argv[++i]);
    }
    if (arg === "--format" && argv[i + 1]) {
      args.formats = argv[++i].split(",").map((s) => s.trim());
    }
  }

  return args;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function buildMarkdown(manifest) {
  const lines = [
    "# Backfill validation Lot 9 — manifest",
    "",
    `**Généré :** ${manifest.generated_at}`,
    `**Mode :** ${manifest.dry_run ? "dry-run (0 écriture Supabase)" : "apply"}`,
    `**Profil :** ${manifest.validation_profile}`,
    `**Pipeline :** ${manifest.pipeline_version}`,
    "",
    "## Métriques globales",
    "",
    "| Métrique | Valeur |",
    "|----------|--------|",
    `| bank_total | ${manifest.bank_total} |`,
    `| validated_auto | ${manifest.summary.validated_auto} |`,
    `| needs_review | ${manifest.summary.needs_review} |`,
    `| rejected | ${manifest.summary.rejected} |`,
    "",
    "## Champs mis à jour (--apply uniquement)",
    "",
    VALIDATION_UPDATE_FIELDS.map((f) => `- \`${f}\``).join("\n"),
    "",
    "## Champs protégés (jamais modifiés)",
    "",
    "- `contenu`, `consigne`, `niveau_vise`, `competence`, `format`, `theme`",
    "",
    "## Top 20 codes d'issues",
    "",
    "| Code | Occurrences |",
    "|------|-------------|",
  ];

  const topCodes = Object.entries(manifest.summary.by_issue_code)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  for (const [code, n] of topCodes) {
    lines.push(`| ${code} | ${n} |`);
  }

  lines.push("", "## Exercices rejected", "");
  const rejected = manifest.entries.filter((e) => e.validation_status === "rejected");
  if (rejected.length === 0) {
    lines.push("_Aucun._");
  } else {
    for (const e of rejected.slice(0, 100)) {
      const codes = [...new Set(e.issues.map((i) => i.code))].join(", ");
      lines.push(`- \`${e.id}\` — ${e.titre ?? "(sans titre)"} — codes: ${codes}`);
    }
    if (rejected.length > 100) lines.push(`\n_… et ${rejected.length - 100} autres._`);
  }

  lines.push("", "## Exercices needs_review (flags)", "");
  const review = manifest.entries.filter((e) => e.validation_status === "needs_review");
  if (review.length === 0) {
    lines.push("_Aucun._");
  } else {
    for (const e of review.slice(0, 100)) {
      const flags = e.flags?.length ? e.flags.join(", ") : "—";
      lines.push(`- \`${e.id}\` — ${e.titre ?? "(sans titre)"} — flags: ${flags}`);
    }
    if (review.length > 100) lines.push(`\n_… et ${review.length - 100} autres._`);
  }

  lines.push("", "---", "_Manifest généré par scripts/backfill-exercices-validation.mjs — Lot 9 backfill._");
  return lines.join("\n");
}

function toUpdatePayload(result) {
  return {
    validation_status: result.status,
    validation_score: result.structuralScore,
    validation_issues: result.issues,
    validation_checked_at: result.checkedAt,
    validation_profile: BACKFILL_PROFILE,
    validation_source: "backfill",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.profile === FORBIDDEN_PROFILE) {
    console.error(
      `ERREUR : --profile ${FORBIDDEN_PROFILE} interdit pour le backfill banque legacy (utiliser ${BACKFILL_PROFILE}).`,
    );
    process.exit(1);
  }
  if (args.profile !== BACKFILL_PROFILE) {
    console.error(
      `ERREUR : --profile invalide "${args.profile}" (seul ${BACKFILL_PROFILE} est autorisé pour le backfill).`,
    );
    process.exit(1);
  }

  await loadEnvLocal();

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Variables requises : SUPABASE_URL (ou VITE_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await supabase
    .from("exercices")
    .select(
      "id, titre, consigne, competence, format, niveau_vise, theme, contexte_irn, contenu, metadata_code, metadata_skill, statut, difficulte, duree_limite_secondes, is_ai_generated, created_at",
    )
    .eq("is_template", false)
    .is("eleve_id", null)
    .limit(5000);

  if (error) {
    console.error("Erreur Supabase (lecture) :", error.message);
    process.exit(1);
  }

  let bankRows = rows ?? [];
  if (args.limit && args.limit > 0) {
    bankRows = bankRows.slice(0, args.limit);
  }

  const bankTotal = bankRows.length;
  if (bankTotal !== 621 && !args.limit) {
    console.warn(`ATTENTION : bank_total=${bankTotal} (attendu 621).`);
  }

  const summary = {
    validated_auto: 0,
    needs_review: 0,
    rejected: 0,
    by_competence: {},
    by_issue_code: {},
  };

  const entries = [];
  const allIssueCounts = {};

  for (const row of bankRows) {
    const exercise = {
      ...row,
      metadata:
        row.duree_limite_secondes != null
          ? { time_limit_seconds: row.duree_limite_secondes, code: row.metadata_skill ?? undefined }
          : undefined,
    };
    const result = await runValidationChain(exercise, {
      profile: BACKFILL_PROFILE,
      context: {
        targetNiveauVise: row.niveau_vise,
        targetThemeId: row.theme,
      },
    });

    summary[result.status]++;
    const comp = row.competence ?? "unknown";
    summary.by_competence[comp] = summary.by_competence[comp] ?? { validated_auto: 0, needs_review: 0, rejected: 0 };
    summary.by_competence[comp][result.status]++;

    for (const issue of result.issues) {
      allIssueCounts[issue.code] = (allIssueCounts[issue.code] ?? 0) + 1;
    }

    const updatePayload = toUpdatePayload(result);

    entries.push({
      id: row.id,
      metadata_code: row.metadata_code,
      competence: row.competence,
      niveau_vise: row.niveau_vise,
      titre: row.titre,
      validation_status: updatePayload.validation_status,
      validation_score: updatePayload.validation_score,
      validation_profile: updatePayload.validation_profile,
      validation_source: updatePayload.validation_source,
      validation_checked_at: updatePayload.validation_checked_at,
      issue_count: result.issues.length,
      flags: result.flags,
      issues: result.issues.map((i) => ({
        code: i.code,
        severity: i.severity,
        layer: i.layer,
        message: i.message,
      })),
      update: updatePayload,
    });
  }

  summary.by_issue_code = allIssueCounts;

  const generatedAt = new Date().toISOString();
  const slug = timestampSlug();
  const outputDir =
    args.outputDir ??
    resolve(__dirname, "backups", `validation-backfill-${BACKFILL_PROFILE}-${slug}`);
  await mkdir(outputDir, { recursive: true });

  const manifest = {
    lot: "9-validation-backfill",
    generated_at: generatedAt,
    dry_run: args.dryRun,
    validation_profile: BACKFILL_PROFILE,
    bank_total: bankTotal,
    pipeline_version: "L1-L7-deterministic",
    fields_updated: VALIDATION_UPDATE_FIELDS,
    fields_protected: ["contenu", "consigne", "niveau_vise", "competence", "format", "theme"],
    summary,
    entries,
  };

  const jsonPath = resolve(outputDir, `validation-backfill-${slug}.json`);
  const mdPath = resolve(outputDir, `validation-backfill-${slug}.md`);

  if (args.formats.includes("json")) {
    await writeFile(jsonPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log(`JSON : ${jsonPath}`);
  }
  if (args.formats.includes("md")) {
    await writeFile(mdPath, buildMarkdown(manifest), "utf8");
    console.log(`MD   : ${mdPath}`);
  }

  console.log("\nRésumé :");
  console.log(`  mode            : ${args.dryRun ? "dry-run" : "apply"}`);
  console.log(`  profile         : ${BACKFILL_PROFILE}`);
  console.log(`  bank_total      : ${bankTotal}`);
  console.log(`  validated_auto  : ${summary.validated_auto}`);
  console.log(`  needs_review    : ${summary.needs_review}`);
  console.log(`  rejected        : ${summary.rejected}`);

  if (args.dryRun) {
    console.log("\n0 écriture Supabase (dry-run). Relancer avec --apply après migration + GO.");
    return;
  }

  let applied = 0;
  let failed = 0;
  for (const entry of entries) {
    const { error: upErr } = await supabase
      .from("exercices")
      .update(entry.update)
      .eq("id", entry.id);
    if (upErr) {
      console.error(`Echec ${entry.id}:`, upErr.message);
      failed++;
      continue;
    }
    applied++;
  }

  console.log(`\nAppliqué : ${applied} lignes mises à jour, ${failed} échecs.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
