/**
 * pre-session-selection-dry-run.mjs — Lot 9 sélection pré-séance (READ ONLY).
 * Lit Supabase, exécute preSessionSelectExercises, écrit rapports JSON+MD locaux.
 *
 * USAGE :
 *   node --import tsx scripts/pre-session-selection-dry-run.mjs
 *   node --import tsx scripts/pre-session-selection-dry-run.mjs --scenario all
 *
 * INTERDIT : toute écriture Supabase, génération IA, Lot 8.
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { preSessionSelectExercises } from "../src/lib/pre-session-selection.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SCENARIOS = {
  A1_CE: { label: "A1 CE quota 5 (scénario A)", niveauVise: "A1", competence: "CE", quota: 5 },
  A2_CO_PREF: {
    label: "A2 CO thème prefecture quota 5 (scénario B)",
    niveauVise: "A2",
    competence: "CO",
    themeId: "prefecture",
    quota: 5,
  },
  B2_CE: { label: "B2 CE quota 5 cellule P0 (scénario C)", niveauVise: "B2", competence: "CE", quota: 5 },
  B1_CO_PREF: {
    label: "B1 CO thème prefecture quota 5 (scénario D)",
    niveauVise: "B1",
    competence: "CO",
    themeId: "prefecture",
    quota: 5,
  },
};

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
  const args = { scenario: "all", outputDir: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--scenario" && argv[i + 1]) args.scenario = argv[++i];
    if (arg === "--output-dir" && argv[i + 1]) args.outputDir = argv[++i];
    if (arg === "--apply") {
      console.error("ERREUR : --apply interdit (dry-run read-only uniquement).");
      process.exit(1);
    }
  }
  return args;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function buildMarkdown(reportBundle) {
  const lines = [
    "# Dry-run sélection pré-séance — Lot 9",
    "",
    `**Généré :** ${reportBundle.generated_at}`,
    `**Mode :** dry-run (0 écriture Supabase, 0 génération IA)`,
    `**Banque lue :** ${reportBundle.bank_total} exercices`,
    "",
    "## Scénarios exécutés",
    "",
  ];

  for (const run of reportBundle.runs) {
    lines.push(`### ${run.scenario_id} — ${run.label}`, "");
    lines.push(`| Métrique | Valeur |`);
    lines.push(`|----------|--------|`);
    lines.push(`| retained | ${run.report.retained.length} |`);
    lines.push(`| gap | ${run.report.remaining_gaps[0]?.gap ?? "—"} |`);
    lines.push(`| generation_need | ${run.report.generation_need.required ? "oui" : "non"} |`);
    lines.push(`| total_gap signalé | ${run.report.generation_need.total_gap} |`);
    lines.push(`| nr_fallback_allowed | ${run.report.meta.nr_fallback_allowed} |`);
    lines.push(`| human_review_items | ${run.report.human_review_items.length} |`);
    lines.push("");

    if (run.report.retained.length > 0) {
      lines.push("**Retenus (échantillon)** :");
      for (const r of run.report.retained.slice(0, 10)) {
        lines.push(
          `- \`${r.exercice_id}\` — ${r.titre ?? "(sans titre)"} — ${r.selection_tier} — score ${r.score}`,
        );
      }
      lines.push("");
    }

    const topExcluded = Object.entries(run.report.excluded.counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    if (topExcluded.length > 0) {
      lines.push("**Exclusions (top)** :");
      for (const [code, n] of topExcluded) {
        lines.push(`- ${code}: ${n}`);
      }
      lines.push("");
    }

    if (run.report.human_review_items.length > 0) {
      lines.push("**Relecture humaine** :");
      for (const item of run.report.human_review_items) {
        lines.push(`- [${item.priority}] ${item.type} — ${item.message}`);
      }
      lines.push("");
    }
  }

  lines.push(
    "---",
    "_Rapport généré par scripts/pre-session-selection-dry-run.mjs — Lot 9 pré-séance dry-run._",
  );
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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
      "id, titre, consigne, competence, niveau_vise, format, theme, contenu, validation_status, validation_issues, validation_score, is_template, eleve_id",
    )
    .eq("is_template", false)
    .is("eleve_id", null)
    .limit(5000);

  if (error) {
    console.error("Erreur Supabase (lecture seule) :", error.message);
    process.exit(1);
  }

  const bankRows = rows ?? [];
  console.log(`Banque lue : ${bankRows.length} exercices (read-only).`);

  const scenarioKeys =
    args.scenario === "all"
      ? Object.keys(SCENARIOS)
      : Object.keys(SCENARIOS).filter((k) => k.toLowerCase() === args.scenario.toLowerCase());

  if (scenarioKeys.length === 0) {
    console.error(`Scénario inconnu : ${args.scenario}. Disponibles : ${Object.keys(SCENARIOS).join(", ")}, all`);
    process.exit(1);
  }

  const runs = [];
  for (const scenarioId of scenarioKeys) {
    const scenario = SCENARIOS[scenarioId];
    const report = preSessionSelectExercises(bankRows, {
      niveauVise: scenario.niveauVise,
      competence: scenario.competence,
      themeId: scenario.themeId ?? null,
      quota: scenario.quota,
    });
    runs.push({ scenario_id: scenarioId, label: scenario.label, report });
    console.log(
      `[${scenarioId}] retained=${report.retained.length} gap=${report.remaining_gaps[0].gap} generation_need=${report.generation_need.required}`,
    );
  }

  const slug = timestampSlug();
  const outDir =
    args.outputDir ?? resolve(ROOT, "scripts", "backups", `pre-session-selection-dry-run-${slug}`);
  await mkdir(outDir, { recursive: true });

  const bundle = {
    generated_at: new Date().toISOString(),
    mode: "dry-run",
    supabase_writes: 0,
    ai_generation: 0,
    bank_total: bankRows.length,
    runs,
  };

  const jsonPath = resolve(outDir, `pre-session-selection-dry-run-${slug}.json`);
  const mdPath = resolve(outDir, `pre-session-selection-dry-run-${slug}.md`);

  await writeFile(jsonPath, JSON.stringify(bundle, null, 2), "utf8");
  await writeFile(mdPath, buildMarkdown(bundle), "utf8");

  console.log(`Rapport JSON : ${jsonPath}`);
  console.log(`Rapport MD   : ${mdPath}`);
  console.log("Confirmation : 0 écriture Supabase, 0 génération IA.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
