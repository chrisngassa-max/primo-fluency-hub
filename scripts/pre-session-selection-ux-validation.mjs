/**
 * pre-session-selection-ux-validation.mjs — Rapport UX/data validation (READ ONLY).
 * Utilise fetchPreSessionBankCandidates + preSessionSelectExercises.
 *
 * USAGE :
 *   node --import tsx scripts/pre-session-selection-ux-validation.mjs
 *
 * INTERDIT : toute écriture Supabase, génération IA, Lot 8.
 */

import { writeFile, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { fetchPreSessionBankCandidates } from "../src/lib/pre-session-selection-data.ts";
import {
  preSessionSelectExercises,
  classifyNrTier,
  NR_MAX_RATIO,
} from "../src/lib/pre-session-selection.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SCENARIOS = [
  { id: "S1", label: "A1 / CE / quota 5", niveauVise: "A1", competence: "CE", themeId: null, quota: 5 },
  {
    id: "S2",
    label: "A2 / CO / prefecture / quota 5",
    niveauVise: "A2",
    competence: "CO",
    themeId: "prefecture",
    quota: 5,
  },
  {
    id: "S3",
    label: "B1 / CO / prefecture / quota 5",
    niveauVise: "B1",
    competence: "CO",
    themeId: "prefecture",
    quota: 5,
  },
  { id: "S4", label: "B2 / CE / quota 5", niveauVise: "B2", competence: "CE", themeId: null, quota: 5 },
  {
    id: "S5",
    label: "A2 / Structures / quota 5",
    niveauVise: "A2",
    competence: "Structures",
    themeId: null,
    quota: 5,
  },
  { id: "S6", label: "B1 / EE / quota 5", niveauVise: "B1", competence: "EE", themeId: null, quota: 5 },
  {
    id: "S7",
    label: "B2 / Structures / quota 5",
    niveauVise: "B2",
    competence: "Structures",
    themeId: null,
    quota: 5,
  },
];

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

function topExcluded(excluded, limit = 5) {
  return Object.entries(excluded.counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([code, n]) => ({ code, count: n }));
}

function checkRuleCompliance(scenario, report, candidatesById) {
  const issues = [];
  const retained = report.retained;
  const quota = scenario.quota;
  const p2Max = Math.floor(quota * NR_MAX_RATIO);

  const rejectedInRetained = retained.filter((r) => r.validation_status === "rejected");
  if (rejectedInRetained.length > 0) {
    issues.push(`rejected in retained: ${rejectedInRetained.length}`);
  }

  const nrRougeInRetained = retained.filter((r) => {
    if (r.validation_status !== "needs_review") return false;
    const cand = candidatesById.get(r.exercice_id);
    if (!cand) return false;
    return classifyNrTier(cand.validation_issues, cand.theme) === "rouge";
  });
  if (nrRougeInRetained.length > 0) {
    issues.push(`NR rouge in retained: ${nrRougeInRetained.length}`);
  }

  const p2Count = retained.filter((r) => r.selection_tier.startsWith("P2_")).length;
  if (p2Count > p2Max) {
    issues.push(`P2 exceeds max ${p2Max} (${Math.round(NR_MAX_RATIO * 100)}%): used ${p2Count}`);
  }

  const isPrefectureB1B2 =
    scenario.themeId === "prefecture" &&
    (scenario.niveauVise === "B1" || scenario.niveauVise === "B2");
  if (isPrefectureB1B2 && report.meta.nr_fallback_allowed) {
    issues.push("nr_fallback_allowed should be false for prefecture B1/B2");
  }
  if (isPrefectureB1B2 && p2Count > 0) {
    issues.push(`auto NR fallback used on prefecture ${scenario.niveauVise}: ${p2Count} P2`);
  }

  return {
    compliant: issues.length === 0,
    issues,
    checks: {
      no_rejected_in_retained: rejectedInRetained.length === 0,
      no_nr_rouge_in_retained: nrRougeInRetained.length === 0,
      p2_within_max: p2Count <= p2Max,
      no_prefecture_b1b2_nr_fallback:
        !isPrefectureB1B2 || (report.meta.nr_fallback_allowed === false && p2Count === 0),
    },
  };
}

function buildScenarioSummary(scenario, report, bankTotal, candidatesById) {
  const gap = report.remaining_gaps[0];
  const p1Count = report.retained.filter((r) => r.selection_tier === "P1_validated").length;
  const p2Count = report.retained.filter((r) => r.selection_tier.startsWith("P2_")).length;
  const compliance = checkRuleCompliance(scenario, report, candidatesById);

  return {
    scenario_id: scenario.id,
    label: scenario.label,
    params: {
      niveauVise: scenario.niveauVise,
      competence: scenario.competence,
      themeId: scenario.themeId,
      quota: scenario.quota,
    },
    bank_total: bankTotal,
    retained_count: report.retained.length,
    p1_count: p1Count,
    p2_count_used: p2Count,
    p1_pool: report.meta.p1_pool,
    p2_pool_vert: report.meta.p2_pool_vert,
    p2_pool_orange: report.meta.p2_pool_orange,
    nr_fallback_allowed: report.meta.nr_fallback_allowed,
    top_excluded: topExcluded(report.excluded),
    remaining_gap: gap?.gap ?? null,
    generation_need: report.generation_need.required,
    generation_total_gap: report.generation_need.total_gap,
    generation_reason: report.generation_need.slots[0]?.reason ?? null,
    defer_to_lot8_p0: report.generation_need.defer_to_lot8_p0,
    human_review_items_count: report.human_review_items.length,
    human_review_types: [...new Set(report.human_review_items.map((h) => h.type))],
    rule_compliance: compliance,
    va_in_bank: gap?.va_in_bank ?? null,
    is_p0_cell: gap?.is_p0_cell ?? false,
    severity: gap?.severity ?? null,
  };
}

function buildMarkdown(bundle) {
  const lines = [
    "# Rapport UX / data validation — PreSessionSelectionReport",
    "",
    `**Généré :** ${bundle.generated_at}`,
    `**Commit de référence :** 15073de (banque Supabase réelle via \`fetchPreSessionBankCandidates\`)`,
    `**Mode :** read-only — 0 écriture Supabase, 0 génération IA`,
    `**Banque lue (globale) :** ${bundle.bank_total} exercices \`legacy_bank\``,
    "",
    "## Synthèse",
    "",
    "| Scénario | Banque | Retenus | P1 | P2 | Gap | Gen. need | Human review | Conformité |",
    "|----------|--------|---------|----|----|-----|-----------|--------------|------------|",
  ];

  for (const s of bundle.scenarios) {
    const ok = s.rule_compliance.compliant ? "✅" : "❌";
    lines.push(
      `| ${s.label} | ${s.bank_total} | ${s.retained_count}/${s.params.quota} | ${s.p1_count} | ${s.p2_count_used} | ${s.remaining_gap} | ${s.generation_need ? "oui" : "non"} | ${s.human_review_items_count} | ${ok} |`,
    );
  }

  lines.push("", "## Détail par scénario", "");

  for (const s of bundle.scenarios) {
    lines.push(`### ${s.scenario_id} — ${s.label}`, "");
    lines.push("| Métrique | Valeur |");
    lines.push("|----------|--------|");
    lines.push(`| total banque lue | ${s.bank_total} |`);
    lines.push(`| retained count | ${s.retained_count} / ${s.params.quota} |`);
    lines.push(`| P1 count | ${s.p1_count} |`);
    lines.push(`| P2 count used | ${s.p2_count_used} |`);
    lines.push(`| P1 pool (éligibles) | ${s.p1_pool} |`);
    lines.push(`| P2 pool vert | ${s.p2_pool_vert} |`);
    lines.push(`| P2 pool orange | ${s.p2_pool_orange} |`);
    lines.push(`| nr_fallback_allowed | ${s.nr_fallback_allowed} |`);
    lines.push(`| VA en banque (cellule) | ${s.va_in_bank} |`);
    lines.push(`| cellule P0 | ${s.is_p0_cell ? "oui" : "non"} |`);
    lines.push(`| remaining_gap | ${s.remaining_gap} |`);
    lines.push(`| generation_need | ${s.generation_need ? "true" : "false"} |`);
    lines.push(`| generation total_gap | ${s.generation_total_gap} |`);
    lines.push(`| generation reason | ${s.generation_reason ?? "—"} |`);
    lines.push(`| defer_to_lot8_p0 | ${s.defer_to_lot8_p0 ? "oui" : "non"} |`);
    lines.push(`| severity | ${s.severity} |`);
    lines.push(`| human_review_items | ${s.human_review_items_count} |`);
    if (s.human_review_types.length > 0) {
      lines.push(`| human_review types | ${s.human_review_types.join(", ")} |`);
    }
    lines.push("");

    if (s.top_excluded.length > 0) {
      lines.push("**Exclusions principales :**");
      for (const ex of s.top_excluded) {
        lines.push(`- \`${ex.code}\` : ${ex.count}`);
      }
      lines.push("");
    }

    lines.push("**Conformité règles :**");
    const c = s.rule_compliance.checks;
    lines.push(`- Pas de rejected dans retained : ${c.no_rejected_in_retained ? "✅" : "❌"}`);
    lines.push(`- Pas de NR rouge dans retained : ${c.no_nr_rouge_in_retained ? "✅" : "❌"}`);
    lines.push(`- P2 ≤ 30 % du quota : ${c.p2_within_max ? "✅" : "❌"}`);
    lines.push(
      `- Pas de repli NR auto prefecture B1/B2 : ${c.no_prefecture_b1b2_nr_fallback ? "✅" : "❌"}`,
    );
    if (s.rule_compliance.issues.length > 0) {
      lines.push("");
      lines.push("**Écarts détectés :**");
      for (const issue of s.rule_compliance.issues) {
        lines.push(`- ${issue}`);
      }
    }
    lines.push("");
  }

  const allCompliant = bundle.scenarios.every((s) => s.rule_compliance.compliant);
  lines.push("## Conclusion globale", "");
  lines.push(
    allCompliant
      ? "Tous les scénarios respectent les règles de conformité vérifiées."
      : "Au moins un scénario présente des écarts de conformité — voir détails ci-dessus.",
  );
  lines.push("");
  lines.push(
    "---",
    "_Rapport généré par `scripts/pre-session-selection-ux-validation.mjs` — validation read-only Lot 9._",
  );

  return lines.join("\n");
}

async function main() {
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

  console.log("Chargement banque via fetchPreSessionBankCandidates (read-only)...");
  const candidates = await fetchPreSessionBankCandidates(supabase);
  const bankTotal = candidates.length;
  console.log(`Banque lue : ${bankTotal} exercices.`);

  const candidatesById = new Map(candidates.map((c) => [c.id, c]));

  const scenarios = [];
  for (const scenario of SCENARIOS) {
    const report = preSessionSelectExercises(candidates, {
      niveauVise: scenario.niveauVise,
      competence: scenario.competence,
      themeId: scenario.themeId ?? null,
      quota: scenario.quota,
    });
    const summary = buildScenarioSummary(scenario, report, bankTotal, candidatesById);
    scenarios.push(summary);
    const ok = summary.rule_compliance.compliant ? "OK" : "FAIL";
    console.log(
      `[${scenario.id}] retained=${summary.retained_count} gap=${summary.remaining_gap} gen=${summary.generation_need} compliance=${ok}`,
    );
  }

  const bundle = {
    generated_at: new Date().toISOString(),
    mode: "ux-validation-read-only",
    commit_ref: "15073de",
    bank_total: bankTotal,
    supabase_writes: 0,
    ai_generation: 0,
    scenarios,
  };

  const mdPath = resolve(ROOT, "docs", "pre-session-selection-ux-validation-report.md");
  await writeFile(mdPath, buildMarkdown(bundle), "utf8");
  console.log(`Rapport écrit : ${mdPath}`);
  console.log("Confirmation : 0 écriture Supabase, 0 génération IA.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
