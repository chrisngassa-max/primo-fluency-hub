/**
 * revalidate-lot8-b2-ce.mjs — Revalidation Lot 8 B2 CE depuis manifest dry-run.
 * Corrige la consigne CE:005 si besoin, exécute runValidationChain (generated_strict),
 * écrit manifest corrigé + rapport docs/lot8-b2-ce-revalidation-report.md.
 *
 * USAGE :
 *   node --import tsx scripts/revalidate-lot8-b2-ce.mjs
 *   node --import tsx scripts/revalidate-lot8-b2-ce.mjs --manifest path/to/manifest.json
 *
 * INTERDIT : toute écriture Supabase, session_exercices, génération >5.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import {
  LOT8_B2_CE_SLOTS,
  checkEntryConstraints,
  countWords,
  summarizeManifest,
} from "./lib/lot8-b2-ce-spec.mjs";
import {
  runValidationChain,
  groupIssuesByCode,
} from "../supabase/functions/_shared/validation-chain.ts";
import { hasUsableContent } from "../supabase/functions/_shared/exercise-search.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const EXPECTED_CODES = LOT8_B2_CE_SLOTS.map((s) => s.metadata_code);
const CE005_SHORT_CONSIGNE = "Lisez le document et complétez la lacune.";

function parseArgs(argv) {
  const args = { manifest: null, outputDir: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--manifest" && argv[i + 1]) args.manifest = resolve(argv[++i]);
    if (arg === "--output-dir" && argv[i + 1]) args.outputDir = resolve(argv[++i]);
    if (arg === "--apply") {
      console.error("ERREUR : --apply interdit (revalidation locale uniquement).");
      process.exit(1);
    }
  }
  return args;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function getCommitRef() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function defaultManifestPath() {
  return resolve(
    ROOT,
    "scripts/backups/lot8-b2-ce-dry-run-2026-07-07T23-31-48/lot8-b2-ce-dry-run-2026-07-07T23-31-48.json",
  );
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

function buildReportMarkdown({ manifest, sourceManifest, corrections }) {
  const lines = [
    "# Lot 8 B2 CE — rapport de revalidation",
    "",
    `**Généré :** ${manifest.generated_at}`,
    `**Commit :** ${manifest.commit_ref}`,
    `**Profil :** generated_strict`,
    `**Manifest source :** ${sourceManifest}`,
    `**Manifest corrigé :** ${manifest.manifest_path}`,
    `**Écritures DB :** 0`,
    "",
    "## Corrections appliquées",
    "",
  ];

  if (corrections.length === 0) {
    lines.push("_Aucune correction de contenu — revalidation seule._");
  } else {
    for (const c of corrections) {
      lines.push(`- **${c.metadata_code}** : ${c.field}`);
      lines.push(`  - avant : « ${c.before} » (${c.beforeWords} mots)`);
      lines.push(`  - après : « ${c.after} » (${c.afterWords} mots)`);
    }
  }

  lines.push(
    "",
    "## Résumé",
    "",
    "| Métrique | Valeur |",
    "|----------|--------|",
    `| planned | ${manifest.summary.planned} |`,
    `| validated_auto | ${manifest.summary.validated_auto ?? manifest.entries.filter((e) => e.validation.status === "validated_auto").length} |`,
    `| needs_review | ${manifest.summary.needs_review ?? manifest.entries.filter((e) => e.validation.status === "needs_review").length} |`,
    `| rejected | ${manifest.summary.rejected ?? manifest.entries.filter((e) => e.validation.status === "rejected").length} |`,
    `| all checks OK | ${manifest.summary.all_checks_ok ?? manifest.entries.every((e) => e.checks.allOk)} |`,
    "",
    "## Détail par exercice",
    "",
  );

  for (const entry of manifest.entries) {
    const icon = entry.validation.status === "validated_auto" && entry.checks.allOk ? "✅" : "⚠️";
    lines.push(`### ${icon} ${entry.metadata_code} — ${entry.draft.titre}`, "");
    lines.push(`- **status** : ${entry.validation.status}`);
    lines.push(`- **format** : ${entry.draft.format} | **theme** : ${entry.draft.theme}`);
    lines.push(`- **consigne** (${countWords(entry.draft.consigne)} mots) : ${entry.draft.consigne}`);
    lines.push(`- **texte** : ${countWords(entry.draft.contenu?.texte)} mots`);
    lines.push(`- **hasUsableContent** : ${entry.validation.hasUsableContent}`);
    lines.push(`- **checks** : ${JSON.stringify(entry.checks)}`);
    if (entry.validation.issues.length) {
      lines.push("- **issues** :");
      for (const issue of entry.validation.issues) {
        lines.push(`  - [${issue.severity}] ${issue.code} (${issue.layer}) — ${issue.message}`);
      }
    } else {
      lines.push("- **issues** : aucune");
    }
    lines.push("");
  }

  lines.push(
    "## Commandes",
    "",
    "```bash",
    "node --import tsx scripts/revalidate-lot8-b2-ce.mjs",
    `node --import tsx scripts/apply-lot8-b2-ce.mjs --manifest "${manifest.manifest_path}"`,
    "npm test -- scripts/lib/lot8-b2-ce-spec.test.mjs",
    "```",
    "",
    "---",
    "_Rapport généré par scripts/revalidate-lot8-b2-ce.mjs — 0 écriture Supabase._",
  );

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = args.manifest ?? defaultManifestPath();
  const raw = await readFile(sourcePath, "utf8");
  const source = JSON.parse(raw);

  if (!Array.isArray(source.entries) || source.entries.length !== 5) {
    throw new Error(`Manifest invalide : attendu 5 entrées, reçu ${source.entries?.length ?? 0}`);
  }

  const codes = source.entries.map((e) => e.metadata_code).sort();
  const expected = [...EXPECTED_CODES].sort();
  if (JSON.stringify(codes) !== JSON.stringify(expected)) {
    throw new Error(`metadata_code inattendus : ${codes.join(", ")}`);
  }

  const corrections = [];
  const entries = [];

  for (const entry of source.entries) {
    const draft = structuredClone(entry.draft);

    if (entry.metadata_code === "sf-p0:B2:CE:005" && draft.consigne !== CE005_SHORT_CONSIGNE) {
      corrections.push({
        metadata_code: entry.metadata_code,
        field: "consigne",
        before: draft.consigne,
        beforeWords: countWords(draft.consigne),
        after: CE005_SHORT_CONSIGNE,
        afterWords: countWords(CE005_SHORT_CONSIGNE),
      });
      draft.consigne = CE005_SHORT_CONSIGNE;
    }

    const validation = await validateDraft(draft);
    const checks = checkEntryConstraints(draft, validation);

    entries.push({
      metadata_code: entry.metadata_code,
      generation_mode: entry.generation_mode,
      draft,
      validation,
      checks,
    });
  }

  const summary = {
    ...summarizeManifest(entries),
    validated_auto: entries.filter((e) => e.validation.status === "validated_auto").length,
    needs_review: entries.filter((e) => e.validation.status === "needs_review").length,
    rejected: entries.filter((e) => e.validation.status === "rejected").length,
    all_checks_ok: entries.every((e) => e.checks.allOk),
    db_writes: 0,
  };

  const slug = timestampSlug();
  const outDir =
    args.outputDir ?? resolve(ROOT, "scripts", "backups", `lot8-b2-ce-revalidated-${slug}`);
  await mkdir(outDir, { recursive: true });

  const manifestPath = resolve(outDir, `lot8-b2-ce-revalidated-${slug}.json`);
  const reportPath = resolve(ROOT, "docs", "lot8-b2-ce-revalidation-report.md");

  const manifest = {
    lot: "8-p0-pilot",
    cell: "B2:CE",
    generated_at: new Date().toISOString(),
    commit_ref: getCommitRef(),
    mode: "revalidated",
    dry_run: true,
    validation_profile: "generated_strict",
    generation_limit: 5,
    db_writes: 0,
    source_manifest: sourcePath,
    corrections,
    entries: entries.map((e) => ({
      metadata_code: e.metadata_code,
      generation_mode: e.generation_mode,
      draft: e.draft,
      validation: {
        ok: e.validation.ok,
        status: e.validation.status,
        hasUsableContent: e.validation.hasUsableContent,
        issue_codes: e.validation.issue_codes,
        issues: e.validation.issues,
        layers: e.validation.layers,
        flags: e.validation.flags,
        checkedAt: e.validation.checkedAt,
      },
      checks: e.checks,
    })),
    summary,
    manifest_path: manifestPath,
    report_path: reportPath,
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(reportPath, buildReportMarkdown({ manifest, sourceManifest: sourcePath, corrections }), "utf8");

  console.log("Lot 8 B2 CE — revalidation (0 écriture DB)\n");
  console.log(`  source   : ${sourcePath}`);
  console.log(`  manifest : ${manifestPath}`);
  console.log(`  rapport  : ${reportPath}`);
  console.log(`  corrections : ${corrections.length}`);
  console.log(`  validated_auto : ${summary.validated_auto}/5`);
  console.log(`  needs_review   : ${summary.needs_review}/5`);
  console.log(`  rejected       : ${summary.rejected}/5`);

  if (summary.rejected > 0 || summary.needs_review > 0 || !summary.all_checks_ok) {
    console.error("\nNO-GO : revalidation incomplète.");
    process.exit(1);
  }

  console.log("\nGO revalidation — 5/5 validated_auto, 0 écriture Supabase.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
