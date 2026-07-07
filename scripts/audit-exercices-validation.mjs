/**
 * audit-exercices-validation.mjs — Lot 9 dry-run audit banque 621 exercices.
 * Lit Supabase (READ ONLY), exécute runValidationChain L1–L7, écrit rapports locaux.
 *
 * USAGE :
 *   npm run audit:validation
 *   node --import tsx scripts/audit-exercices-validation.mjs --dry-run
 *   node --import tsx scripts/audit-exercices-validation.mjs --dry-run --profile legacy_bank
 *
 * INTERDIT Lot 9 : --apply (erreur explicite)
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  runValidationChain,
  groupIssuesByCode,
} from "../supabase/functions/_shared/validation-chain.ts";
import { formatsAutorisesForCompetence } from "../supabase/functions/_shared/exercise-search.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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
    outputDir: null,
    limit: null,
    formats: ["json", "md"],
    profile: "generated_strict",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") args.apply = true;
    if (arg === "--dry-run") args.dryRun = true;
    if (arg === "--profile" && argv[i + 1]) {
      const profile = argv[++i];
      if (profile !== "legacy_bank" && profile !== "generated_strict") {
        console.error(`ERREUR : --profile invalide "${profile}" (legacy_bank | generated_strict).`);
        process.exit(1);
      }
      args.profile = profile;
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

function findFormatCompetenceInconsistencies(rows) {
  return rows
    .filter((row) => {
      const allowed = formatsAutorisesForCompetence(row.competence);
      return row.format && row.competence && allowed.length > 0 && !allowed.includes(row.format);
    })
    .map((row) => ({
      id: row.id,
      metadata_code: row.metadata_code,
      competence: row.competence,
      format: row.format,
      titre: row.titre,
    }));
}

function findDuplicateMetadataCodes(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!row.metadata_code) continue;
    counts.set(row.metadata_code, (counts.get(row.metadata_code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([metadata_code, count]) => ({ metadata_code, count }));
}

function buildMarkdown(report) {
  const lines = [
    "# Audit validation Lot 9 — banque exercices",
    "",
    `**Généré :** ${report.generated_at}`,
    `**Mode :** dry-run (0 écriture Supabase)`,
    `**Profil :** ${report.validation_profile}`,
    `**Pipeline :** ${report.pipeline_version}`,
    "",
    "## Métriques globales",
    "",
    `| Métrique | Valeur |`,
    `|----------|--------|`,
    `| bank_total | ${report.bank_total} |`,
    `| validated_auto | ${report.summary.validated_auto} |`,
    `| needs_review | ${report.summary.needs_review} |`,
    `| rejected | ${report.summary.rejected} |`,
    "",
    "## Top 20 codes d'issues",
    "",
    "| Code | Occurrences |",
    "|------|-------------|",
  ];

  const topCodes = Object.entries(report.summary.by_issue_code)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  for (const [code, n] of topCodes) {
    lines.push(`| ${code} | ${n} |`);
  }

  lines.push("", "## Exercices rejected", "");
  const rejected = report.entries.filter((e) => e.simulated_status === "rejected");
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
  const review = report.entries.filter((e) => e.simulated_status === "needs_review");
  if (review.length === 0) {
    lines.push("_Aucun._");
  } else {
    for (const e of review.slice(0, 100)) {
      const flags = e.flags?.length ? e.flags.join(", ") : "—";
      lines.push(`- \`${e.id}\` — ${e.titre ?? "(sans titre)"} — flags: ${flags}`);
    }
    if (review.length > 100) lines.push(`\n_… et ${review.length - 100} autres._`);
  }

  lines.push("", "## Annexe — doublons metadata_code", "");
  if (report.duplicate_metadata_codes.length === 0) {
    lines.push("_Aucun doublon._");
  } else {
    for (const d of report.duplicate_metadata_codes) {
      lines.push(`- \`${d.metadata_code}\` × ${d.count}`);
    }
  }

  lines.push("", "## Annexe — incohérences format/compétence connues (dette Lot 8)", "");
  lines.push(
    `Total : **${report.format_competence_inconsistencies.length}** (non corrigées en Lot 9).`,
    "",
  );
  if (report.format_competence_inconsistencies.length > 0) {
    lines.push("| id | metadata_code | competence | format | titre |", "|----|---------------|------------|--------|-------|");
    for (const row of report.format_competence_inconsistencies) {
      lines.push(
        `| ${row.id} | ${row.metadata_code ?? ""} | ${row.competence} | ${row.format} | ${(row.titre ?? "").slice(0, 40)} |`,
      );
    }
  }

  lines.push("", "---", "_Rapport généré par scripts/audit-exercices-validation.mjs — Lot 9 socle dry-run._");
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.apply) {
    console.error("ERREUR : --apply est interdit en Lot 9 (dry-run uniquement).");
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

  let query = supabase
    .from("exercices")
    .select(
      "id, titre, consigne, competence, format, niveau_vise, theme, contexte_irn, contenu, metadata_code, metadata_skill, statut, difficulte, duree_limite_secondes, is_ai_generated, created_at",
    )
    .eq("is_template", false)
    .is("eleve_id", null)
    .limit(5000);

  const { data: rows, error } = await query;
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
    top_rejected_codes: [],
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
      profile: args.profile,
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

    entries.push({
      id: row.id,
      metadata_code: row.metadata_code,
      competence: row.competence,
      niveau_vise: row.niveau_vise,
      simulated_status: result.status,
      issue_count: result.issues.length,
      flags: result.flags,
      issues: result.issues.map((i) => ({
        code: i.code,
        severity: i.severity,
        layer: i.layer,
        message: i.message,
      })),
    });
  }

  summary.by_issue_code = allIssueCounts;
  summary.top_rejected_codes = Object.entries(
    groupIssuesByCode(
      entries.flatMap((e) =>
        e.simulated_status === "rejected" ? e.issues.map((i) => ({ ...i, layer: i.layer })) : [],
      ),
    ),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, count]) => ({ code, count }));

  const duplicate_metadata_codes = findDuplicateMetadataCodes(bankRows);
  const format_competence_inconsistencies = findFormatCompetenceInconsistencies(bankRows);

  const generatedAt = new Date().toISOString();
  const slug = timestampSlug();
  const outputDir =
    args.outputDir ??
    resolve(__dirname, "backups", `validation-audit-${args.profile}-${slug}`);
  await mkdir(outputDir, { recursive: true });

  const report = {
    lot: "9-validation-socle",
    generated_at: generatedAt,
    dry_run: true,
    validation_profile: args.profile,
    bank_total: bankTotal,
    pipeline_version: "L1-L7-deterministic",
    summary,
    duplicate_metadata_codes,
    format_competence_inconsistencies,
    entries,
  };

  const jsonPath = resolve(outputDir, `validation-audit-${slug}.json`);
  const mdPath = resolve(outputDir, `validation-audit-${slug}.md`);

  if (args.formats.includes("json")) {
    await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`JSON : ${jsonPath}`);
  }
  if (args.formats.includes("md")) {
    await writeFile(mdPath, buildMarkdown(report), "utf8");
    console.log(`MD   : ${mdPath}`);
  }

  console.log("\nRésumé :");
  console.log(`  profile         : ${args.profile}`);
  console.log(`  bank_total      : ${bankTotal}`);
  console.log(`  validated_auto  : ${summary.validated_auto}`);
  console.log(`  needs_review    : ${summary.needs_review}`);
  console.log(`  rejected        : ${summary.rejected}`);
  console.log(`  doublons metadata_code : ${duplicate_metadata_codes.length}`);
  console.log(`  incohérences format/compétence : ${format_competence_inconsistencies.length}`);
  console.log("\n0 écriture Supabase (dry-run).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
