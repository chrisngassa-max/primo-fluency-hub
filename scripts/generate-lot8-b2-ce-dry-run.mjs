/**
 * generate-lot8-b2-ce-dry-run.mjs — Pilote Lot 8 B2 CE (5 exercices max, 0 écriture DB).
 *
 * Génère et valide 5 exercices B2 CE (sf-p0:B2:CE:001–005) via :
 *   1. Edge Function generate-exercises si SUPABASE_URL + clés disponibles
 *   2. Gabarits déterministes (--skip-ai ou repli si l'appel IA échoue)
 *
 * USAGE :
 *   npm run dry-run:lot8-b2-ce
 *   node --import tsx scripts/generate-lot8-b2-ce-dry-run.mjs
 *   node --import tsx scripts/generate-lot8-b2-ce-dry-run.mjs --skip-ai
 *
 * INTERDIT : insert/update Supabase, session_exercices, génération >5.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import {
  LOT8_B2_CE_SLOTS,
  buildDeterministicExercise,
  checkEntryConstraints,
  countDistinctThemes,
  countWords,
  finalizeDraftExercise,
  summarizeManifest,
  themeLabel,
} from "./lib/lot8-b2-ce-spec.mjs";
import {
  runValidationChain,
  groupIssuesByCode,
} from "../supabase/functions/_shared/validation-chain.ts";
import { hasUsableContent } from "../supabase/functions/_shared/exercise-search.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PAUSE_MS = 2000;

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
  const args = { skipAi: false, outputDir: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--skip-ai") args.skipAi = true;
    if (arg === "--apply") {
      console.error("ERREUR : --apply interdit (dry-run uniquement, 0 écriture DB).");
      process.exit(1);
    }
    if (arg === "--output-dir" && argv[i + 1]) args.outputDir = argv[++i];
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, key, ready: Boolean(url && key) };
}

function buildAiEnvDoc() {
  return {
    required_for_ai: [
      "SUPABASE_URL (ou VITE_SUPABASE_URL)",
      "SUPABASE_SERVICE_ROLE_KEY",
      "Edge Function generate-exercises déployée avec clés IA (OPENROUTER_API_KEY ou équivalent côté Supabase)",
    ],
    fallback: "Gabarits déterministes via --skip-ai ou repli automatique si l'appel edge échoue",
  };
}

async function invokeGenerateExercises(slot, { url, key }) {
  const endpoint = `${url.replace(/\/$/, "")}/functions/v1/generate-exercises`;
  const body = {
    competence: "CE",
    niveauVise: "B2",
    count: 1,
    difficultyLevel: 5,
    type_demarche: "naturalisation",
    themeId: slot.theme,
    pointName: themeLabel(slot.theme),
    searchFirst: false,
    targetDurationMinutes: 8,
    existingExercises: [{ format: slot.format, competence: "CE" }],
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data?.error) throw new Error(data.error);

  const exercises = data?.exercises ?? [];
  if (!exercises.length) throw new Error("generate-exercises a renvoyé 0 exercice");

  const raw = exercises[0];
  if (raw.format && raw.format !== slot.format) {
    throw new Error(`format attendu ${slot.format}, reçu ${raw.format}`);
  }

  return finalizeDraftExercise(slot, {
    titre: raw.titre,
    consigne: raw.consigne,
    contenu: raw.contenu,
  }, { generationMode: "edge_function" });
}

async function generateForSlot(slot, { skipAi, supabase }) {
  if (!skipAi && supabase.ready) {
    try {
      const draft = await invokeGenerateExercises(slot, supabase);
      return { draft, generation_mode: "edge_function" };
    } catch (err) {
      console.warn(`  ⚠ ${slot.metadata_code} : edge generate-exercises échoué (${err.message}) — repli déterministe`);
    }
  }

  return {
    draft: buildDeterministicExercise(slot),
    generation_mode: skipAi ? "deterministic_skip_ai" : "deterministic_fallback",
  };
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
  };
}

function buildMarkdown(manifest) {
  const lines = [
    "# Lot 8 pilote B2 CE — dry-run contrôlé (5 exercices)",
    "",
    `**Généré :** ${manifest.generated_at}`,
    `**Commit :** ${manifest.commit_ref}`,
    `**Mode :** ${manifest.mode}`,
    `**Profil validation :** ${manifest.validation_profile}`,
    `**Écritures DB :** ${manifest.summary.db_writes} (interdit)`,
    "",
    "## Résumé",
    "",
    "| Métrique | Valeur |",
    "|----------|--------|",
    `| planned | ${manifest.summary.planned} |`,
    `| valid | ${manifest.summary.valid} |`,
    `| invalid | ${manifest.summary.invalid} |`,
    `| thèmes distincts | ${manifest.summary.distinct_themes} (${manifest.summary.themes.join(", ")}) |`,
    `| formats | ${Object.entries(manifest.summary.formats).map(([k, v]) => `${k}:${v}`).join(", ")} |`,
    "",
    "## Génération",
    "",
    `| Slot | Mode |`,
    "|------|------|",
  ];

  for (const e of manifest.entries) {
    lines.push(`| ${e.metadata_code} | ${e.generation_mode} |`);
  }

  if (manifest.ai_env) {
    lines.push("", "## Prérequis IA (si edge function)", "");
    for (const req of manifest.ai_env.required_for_ai) {
      lines.push(`- ${req}`);
    }
    lines.push(`- Repli : ${manifest.ai_env.fallback}`);
  }

  lines.push("", "## Validation par exercice", "");
  for (const e of manifest.entries) {
    const icon = e.validation.ok && e.checks.allOk ? "✅" : "❌";
    lines.push(`### ${icon} ${e.metadata_code} — ${e.draft.titre}`, "");
    lines.push(`- **format** : ${e.draft.format}`);
    lines.push(`- **theme** : ${e.draft.theme}`);
    lines.push(`- **mots texte** : ${countWords(e.draft.contenu?.texte)}`);
    lines.push(`- **status** : ${e.validation.status}`);
    lines.push(`- **hasUsableContent** : ${e.validation.hasUsableContent}`);
    lines.push(`- **checks** : ${JSON.stringify(e.checks)}`);
    if (e.validation.issues.length) {
      lines.push("- **issues** :");
      for (const issue of e.validation.issues) {
        lines.push(`  - [${issue.severity}] ${issue.code} — ${issue.message}`);
      }
    }
    lines.push("");
  }

  lines.push("## Commandes de revue", "", "```bash");
  for (const cmd of manifest.review_commands) {
    lines.push(cmd);
  }
  lines.push("```", "", "---", "_Rapport généré par scripts/generate-lot8-b2-ce-dry-run.mjs — Lot 8 pilote B2 CE._");

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadEnvLocal();

  const supabase = getSupabaseConfig();
  const slug = timestampSlug();
  const outDir = args.outputDir ?? resolve(ROOT, "scripts", "backups", `lot8-b2-ce-dry-run-${slug}`);
  await mkdir(outDir, { recursive: true });

  console.log("Lot 8 B2 CE dry-run — 5 exercices max, 0 écriture DB\n");

  if (args.skipAi) {
    console.log("Mode : --skip-ai (gabarits déterministes uniquement)");
  } else if (!supabase.ready) {
    console.log("Mode : repli déterministe (SUPABASE_URL / SERVICE_ROLE_KEY absents)");
  } else {
    console.log("Mode : tentative generate-exercises edge, repli déterministe si échec");
  }

  const entries = [];

  for (let i = 0; i < LOT8_B2_CE_SLOTS.length; i++) {
    const slot = LOT8_B2_CE_SLOTS[i];
    console.log(`\n[${i + 1}/5] ${slot.metadata_code} (${slot.format}, ${slot.theme})`);

    const { draft, generation_mode } = await generateForSlot(slot, { skipAi: args.skipAi, supabase });
    const validation = await validateDraft(draft);
    const checks = checkEntryConstraints(draft, validation);

    entries.push({
      metadata_code: slot.metadata_code,
      generation_mode,
      draft,
      validation,
      checks,
    });

    const statusLabel = validation.ok && checks.allOk ? "OK" : validation.status;
    console.log(`  → ${statusLabel} | texte=${countWords(draft.contenu?.texte)} mots | usable=${validation.hasUsableContent}`);

    if (i < LOT8_B2_CE_SLOTS.length - 1 && generation_mode === "edge_function") {
      await sleep(PAUSE_MS);
    }
  }

  const summary = summarizeManifest(entries);
  const manifestPath = resolve(outDir, `lot8-b2-ce-dry-run-${slug}.json`);
  const reportPath = resolve(outDir, `lot8-b2-ce-dry-run-${slug}.md`);

  const review_commands = [
    `node --import tsx scripts/generate-lot8-b2-ce-dry-run.mjs`,
    `node --import tsx scripts/generate-lot8-b2-ce-dry-run.mjs --skip-ai`,
    `npm test -- scripts/lib/lot8-b2-ce-spec.test.mjs`,
    `cat "${manifestPath}"`,
  ];

  const manifest = {
    lot: "8-p0-pilot",
    cell: "B2:CE",
    generated_at: new Date().toISOString(),
    commit_ref: getCommitRef(),
    mode: "dry-run",
    dry_run: true,
    validation_profile: "generated_strict",
    generation_limit: 5,
    db_writes: 0,
    ai_env: buildAiEnvDoc(),
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
      },
      checks: e.checks,
    })),
    summary,
    review_commands,
    manifest_path: manifestPath,
    report_path: reportPath,
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(reportPath, buildMarkdown(manifest), "utf8");

  console.log("\n── Résultat ──");
  console.log(`  manifest : ${manifestPath}`);
  console.log(`  rapport  : ${reportPath}`);
  console.log(`  valid    : ${summary.valid}/${summary.planned}`);
  console.log(`  thèmes   : ${summary.distinct_themes} (${summary.themes.join(", ")})`);
  console.log(`  DB writes: ${summary.db_writes}`);

  if (summary.invalid > 0) {
    console.error("\nNO-GO : au moins un exercice invalide.");
    process.exit(1);
  }

  if (countDistinctThemes(entries) < 3) {
    console.error("\nNO-GO : moins de 3 thèmes distincts.");
    process.exit(1);
  }

  console.log("\nGO dry-run — 0 écriture Supabase.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
