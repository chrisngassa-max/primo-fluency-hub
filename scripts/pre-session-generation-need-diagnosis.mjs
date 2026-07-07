/**
 * pre-session-generation-need-diagnosis.mjs — Diagnostic generation_need (READ ONLY).
 * Distingue vrais trous banque vs problèmes de scoring/métadonnées.
 *
 * USAGE :
 *   node --import tsx scripts/pre-session-generation-need-diagnosis.mjs
 *
 * INTERDIT : toute écriture Supabase, génération IA, modification scoring.
 */

import { writeFile, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { fetchPreSessionBankCandidates } from "../src/lib/pre-session-selection-data.ts";
import {
  preSessionSelectExercises,
  classifyNrTier,
  isP0Cell,
  cellKey,
} from "../src/lib/pre-session-selection.ts";
import {
  buildScoringContexts,
  canonicalizeTheme,
  formatsAutorisesForCompetence,
  hasUsableContent,
  mapRowToScoringExercise,
  niveauWindow,
  REUSE_SCORE_MIN,
  scoreCandidateWithTheme,
} from "../supabase/functions/_shared/exercise-search.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const GENERATION_NEED_SCENARIOS = [
  {
    id: "S2",
    label: "A2 / CO / prefecture / quota 5",
    niveauVise: "A2",
    competence: "CO",
    themeId: "prefecture",
    quota: 5,
    outcome: "4/5 PARTIAL_GAP",
  },
  {
    id: "S3",
    label: "B1 / CO / prefecture / quota 5",
    niveauVise: "B1",
    competence: "CO",
    themeId: "prefecture",
    quota: 5,
    outcome: "0/5 ALL_REJECTED_OR_STALE (8 VA EXCL_SCORE_LOW)",
  },
  {
    id: "S4",
    label: "B2 / CE / quota 5",
    niveauVise: "B2",
    competence: "CE",
    themeId: null,
    quota: 5,
    outcome: "0/5 P0_CELL_ZERO_VA",
  },
  {
    id: "S6",
    label: "B1 / EE / quota 5",
    niveauVise: "B1",
    competence: "EE",
    themeId: null,
    quota: 5,
    outcome: "1/5 PARTIAL_GAP gap 4",
  },
  {
    id: "S7",
    label: "B2 / Structures / quota 5",
    niveauVise: "B2",
    competence: "Structures",
    themeId: null,
    quota: 5,
    outcome: "0/5 P0_CELL_ZERO_VA",
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

function getCommitRef() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function scoreRow(row, params) {
  if (typeof row.validation_score === "number") {
    return {
      score: row.validation_score,
      excluded: row.validation_score < REUSE_SCORE_MIN,
      exclusionReason: row.validation_score < REUSE_SCORE_MIN ? "score_below_threshold" : undefined,
      matchedRules: [],
      source: "validation_score",
    };
  }
  const target = {
    competence: params.competence,
    niveauVise: params.niveauVise,
    themeId: params.themeId,
    typeDemarche: "titre_sejour",
  };
  const ctx = buildScoringContexts(target);
  const targetThemeId = canonicalizeTheme(params.themeId);
  return {
    ...scoreCandidateWithTheme(mapRowToScoringExercise(row, target), ctx, targetThemeId),
    source: "live_scoring",
  };
}

function classifyDiagnosis(scenario, diag) {
  const { preScoring, scoreLow, vaInBank, p1Pool, report } = diag;
  const gap = report.remaining_gaps[0];
  const genReason = report.generation_need.slots[0]?.reason ?? null;

  if (preScoring.total === 0) {
    return {
      primary: "true_bank_gap",
      label: "Vrai trou banque",
      rationale:
        "Aucun candidat après filtres dimensionnels (compétence, niveau ±1, format, contenu utilisable).",
    };
  }

  if (gap.is_p0_cell && gap.va_in_bank === 0 && preScoring.total > 0) {
    const hasNrOrRejected =
      preScoring.by_status.needs_review > 0 || preScoring.by_status.rejected > 0;
    if (hasNrOrRejected && preScoring.by_status.validated_auto + preScoring.by_status.approved_human === 0) {
      return {
        primary: "validation_status_gap",
        label: "Banque présente mais aucun VA",
        rationale:
          "Candidats dimensionnels existent (NR/rejected) mais zéro validated_auto/approved_human — cellule P0.",
      };
    }
    return {
      primary: "true_bank_gap",
      label: "Vrai trou banque (cellule P0)",
      rationale: "Cellule P0 sans aucun exercice validated_auto/approved_human après filtres dimensionnels.",
    };
  }

  if (vaInBank > 0 && p1Pool === 0 && scoreLow.length === vaInBank) {
    return {
      primary: "score_insufficient",
      label: "Banque présente mais score insuffisant",
      rationale: `Les ${vaInBank} VA passent les filtres dimensionnels mais tous échouent au seuil REUSE_SCORE_MIN (${REUSE_SCORE_MIN}).`,
    };
  }

  if (vaInBank > 0 && p1Pool === 0 && scoreLow.length > 0) {
    const themeMismatch = scoreLow.filter((s) =>
      s.exclusion_reason?.includes("EXCL_01"),
    ).length;
    if (themeMismatch > 0) {
      return {
        primary: "theme_misalignment",
        label: "Désalignement thème (scoring EXCL_01)",
        rationale: `${themeMismatch} VA exclus par rupture thématique (EXCL_01) lors du scoring.`,
      };
    }
    return {
      primary: "score_insufficient",
      label: "Banque présente mais score insuffisant",
      rationale: `${scoreLow.length} VA sous le seuil ; ${vaInBank - scoreLow.length} autres exclus par validation/tier.`,
    };
  }

  if (genReason === "PARTIAL_GAP" && p1Pool > 0) {
    const themeTarget = canonicalizeTheme(scenario.themeId);
    const withoutThemeBonus = scoreLow.filter(
      (s) =>
        themeTarget &&
        canonicalizeTheme(s.theme) !== themeTarget &&
        s.validation_status === "validated_auto",
    );
    if (withoutThemeBonus.length > 0 && gap.gap <= 2) {
      return {
        primary: "theme_metadata_gap",
        label: "Écart partiel — métadonnées thème",
        rationale: `Pool P1=${p1Pool} insuffisant ; candidats proches sans thème cible (${withoutThemeBonus.length} sous seuil potentiellement corrigeables).`,
      };
    }
    return {
      primary: "true_bank_gap",
      label: "Vrai trou banque (partiel)",
      rationale: `Pool P1=${p1Pool} < quota ; ${gap.gap} exercice(s) manquant(s) malgré candidats éligibles.`,
    };
  }

  return {
    primary: "mixed",
    label: "Mixte",
    rationale: `VA=${vaInBank}, P1=${p1Pool}, score_low=${scoreLow.length}, reason=${genReason}`,
  };
}

function diagnoseScenario(scenario, candidates) {
  const params = {
    niveauVise: scenario.niveauVise,
    competence: scenario.competence,
    themeId: scenario.themeId ?? null,
    quota: scenario.quota,
  };

  const report = preSessionSelectExercises(candidates, params);
  const niveaux = new Set(niveauWindow(params.niveauVise).map((n) => n.toUpperCase()));
  const allowedFormats = new Set(formatsAutorisesForCompetence(params.competence));
  const targetTheme = canonicalizeTheme(params.themeId);

  const preScoringCandidates = [];
  const scoreLow = [];
  const otherPostDimExclusions = [];

  for (const row of candidates) {
    if (row.competence !== params.competence) continue;
    const niveau = String(row.niveau_vise ?? "").toUpperCase();
    if (!niveaux.has(niveau)) continue;
    const format = String(row.format ?? "");
    if (format && allowedFormats.size > 0 && !allowedFormats.has(format)) continue;
    if (!hasUsableContent(row)) continue;

    const themeCanon = canonicalizeTheme(row.theme);
    const scored = scoreRow(row, params);

    preScoringCandidates.push({
      exercice_id: row.id,
      titre: row.titre ?? null,
      niveau_vise: row.niveau_vise ?? null,
      competence: row.competence ?? null,
      theme: row.theme ?? null,
      theme_canonical: themeCanon,
      format: row.format ?? null,
      validation_status: row.validation_status,
      nr_tier:
        row.validation_status === "needs_review"
          ? classifyNrTier(row.validation_issues, row.theme)
          : null,
      estimated_score: scored.score,
      matched_rules: scored.matchedRules,
      scoring_source: scored.source,
      fresh: row.fresh !== false,
      recent_occurrences: row.recent_occurrences ?? 0,
    });

    const status = row.validation_status;
    if (status === "validated_auto" || status === "approved_human") {
      if (scored.excluded || scored.score < REUSE_SCORE_MIN) {
        const reason = scored.exclusionReason?.startsWith("EXCL_")
          ? "EXCL_SCORING"
          : "EXCL_SCORE_LOW";
        scoreLow.push({
          exercice_id: row.id,
          titre: row.titre ?? null,
          niveau_vise: row.niveau_vise ?? null,
          competence: row.competence ?? null,
          theme: row.theme ?? null,
          theme_canonical: themeCanon,
          format: row.format ?? null,
          validation_status: status,
          estimated_score: scored.score,
          exclusion_reason: reason,
          exclusion_detail: scored.exclusionReason ?? `score ${scored.score} < ${REUSE_SCORE_MIN}`,
          matched_rules: scored.matchedRules,
          fresh: row.fresh !== false,
        });
      }
    } else if (status === "needs_review") {
      otherPostDimExclusions.push({
        exercice_id: row.id,
        validation_status: status,
        nr_tier: classifyNrTier(row.validation_issues, row.theme),
        theme: row.theme,
        estimated_score: scored.score,
      });
    }
  }

  const byStatus = { validated_auto: 0, approved_human: 0, needs_review: 0, rejected: 0, other: 0 };
  for (const c of preScoringCandidates) {
    const s = c.validation_status;
    if (s in byStatus) byStatus[s]++;
    else byStatus.other++;
  }

  const vaInBank = byStatus.validated_auto + byStatus.approved_human;

  const diag = {
    preScoring: {
      total: preScoringCandidates.length,
      by_status: byStatus,
      by_niveau: groupCount(preScoringCandidates, "niveau_vise"),
      by_theme: groupCount(preScoringCandidates, "theme_canonical"),
      by_format: groupCount(preScoringCandidates, "format"),
      candidates: preScoringCandidates,
    },
    scoreLow,
    otherPostDimExclusions,
    vaInBank,
    p1Pool: report.meta.p1_pool,
    report,
  };

  diag.classification = classifyDiagnosis(scenario, diag);
  return diag;
}

function groupCount(items, key) {
  const m = {};
  for (const item of items) {
    const v = String(item[key] ?? "(null)");
    m[v] = (m[v] ?? 0) + 1;
  }
  return m;
}

function recommendFix(scenario, diag) {
  const { classification, scoreLow, preScoring, report } = diag;
  const recs = [];

  switch (classification.primary) {
    case "true_bank_gap":
      recs.push("**Génération** : créer de nouveaux exercices pour la cellule (priorité Lot 8 si P0).");
      if (preScoring.total > 0 && diag.vaInBank === 0) {
        recs.push("Enrichir la banque avec exercices passant validation_auto (actuellement NR/rejected uniquement).");
      }
      break;
    case "score_insufficient":
      recs.push("**Priorité métadonnées/scoring** avant génération massive.");
      if (scenario.themeId) {
        const missingTheme = scoreLow.filter((s) => canonicalizeTheme(s.theme) !== canonicalizeTheme(scenario.themeId));
        if (missingTheme.length > 0) {
          recs.push(
            `Backfill \`theme='${scenario.themeId}'\` sur ${missingTheme.length} VA (bonus SCORE_01 +40 pts manquant → scores typiques ~70 sans thème).`,
          );
        }
        const wrongTheme = scoreLow.filter(
          (s) =>
            canonicalizeTheme(s.theme) &&
            canonicalizeTheme(s.theme) !== canonicalizeTheme(scenario.themeId),
        );
        if (wrongTheme.length > 0) {
          recs.push(`${wrongTheme.length} VA avec thème différent — re-taguer ou accepter exclusion EXCL_01.`);
        }
      }
      const offNiveau = scoreLow.filter((s) => s.niveau_vise?.toUpperCase() !== scenario.niveauVise.toUpperCase());
      if (offNiveau.length > 0) {
        recs.push(
          `${offNiveau.length} VA hors niveau exact (${scenario.niveauVise}) — SCORE_03 (+20) vs SCORE_04 (+10) peut expliquer l'écart de 10 pts.`,
        );
      }
      recs.push(`Seuil actuel REUSE_SCORE_MIN=${REUSE_SCORE_MIN} — ne pas modifier dans ce diagnostic ; envisager enrichissement métadonnées.`);
      break;
    case "theme_misalignment":
      recs.push("Corriger métadonnées `theme` sur les candidats VA ou assouplir la contrainte thématique en séance.");
      break;
    case "validation_status_gap":
      recs.push("Faire passer NR → validated_auto (correction issues) ou générer du neuf validé.");
      break;
    default:
      if (report.remaining_gaps[0]?.gap > 0 && report.meta.p1_pool > 0) {
        recs.push(`Gap partiel (${report.remaining_gaps[0].gap}) : génération ciblée de ${report.remaining_gaps[0].gap} exercice(s).`);
      }
  }

  return recs;
}

function buildMarkdown(bundle) {
  const lines = [
    "# Diagnostic generation_need — PreSessionSelection",
    "",
    `**Généré :** ${bundle.generated_at}`,
    `**Commit :** ${bundle.commit_ref}`,
    `**Mode :** read-only — 0 écriture Supabase, 0 génération IA, 0 modification scoring`,
    `**Banque lue :** ${bundle.bank_total} exercices \`legacy_bank\``,
    `**Seuil réutilisation :** REUSE_SCORE_MIN = ${REUSE_SCORE_MIN}`,
    "",
    "## Méthodologie",
    "",
    "Pour chaque scénario `generation_need` :",
    "",
    "1. **Pool pré-scoring** : candidats passant filtres dimensionnels (`compétence`, `niveau ±1`, `format` autorisé, `hasUsableContent`).",
    "   - Note : le **thème n'est pas un filtre dimensionnel** dans `pre-session-selection.ts` ; il agit via le juge (`EXCL_01` / `SCORE_01`).",
    "2. **Exclusions score bas** : VA (`validated_auto` / `approved_human`) avec score estimé < 80 ou hard-filter scoring.",
    "3. **Classification** : vrai trou banque | score insuffisant | désalignement thème/format | statut validation.",
    "",
    "## Synthèse",
    "",
    "| Scénario | Retenus | Gap | Raison gen. | Pool pré-score | VA banque | P1 pool | Classification |",
    "|----------|---------|-----|-------------|----------------|-----------|---------|----------------|",
  ];

  for (const s of bundle.scenarios) {
    const g = s.report.remaining_gaps[0];
    const gen = s.report.generation_need;
    lines.push(
      `| ${s.label} | ${s.report.retained.length}/${s.params.quota} | ${g.gap} | ${gen.slots[0]?.reason ?? "—"} | ${s.preScoring.total} | ${s.vaInBank} | ${s.p1Pool} | ${s.classification.label} |`,
    );
  }

  for (const s of bundle.scenarios) {
    lines.push("", `---`, "", `## ${s.id} — ${s.label}`, "");
    lines.push(`**Résultat attendu :** ${s.expected_outcome}`);
    lines.push(`**Cellule :** \`${cellKey(s.params.niveauVise, s.params.competence)}\`${s.params.themeId ? ` · thème cible \`${s.params.themeId}\`` : ""}`);
    lines.push(`**P0 :** ${isP0Cell(s.params.niveauVise, s.params.competence) ? "oui" : "non"}`);
    lines.push("");

    const g = s.report.remaining_gaps[0];
    lines.push("### Métriques sélection");
    lines.push("");
    lines.push("| Métrique | Valeur |");
    lines.push("|----------|--------|");
    lines.push(`| retained | ${s.report.retained.length} / ${s.params.quota} |`);
    lines.push(`| P1 pool | ${s.p1Pool} |`);
    lines.push(`| VA en banque (post-filtres dim.) | ${s.vaInBank} |`);
    lines.push(`| remaining_gap | ${g.gap} |`);
    lines.push(`| generation_reason | ${s.report.generation_need.slots[0]?.reason ?? "—"} |`);
    lines.push(`| nr_fallback_allowed | ${s.report.meta.nr_fallback_allowed} |`);
    lines.push("");

    lines.push("### Classification");
    lines.push("");
    lines.push(`- **Verdict :** ${s.classification.label} (\`${s.classification.primary}\`)`);
    lines.push(`- ${s.classification.rationale}`);
    lines.push("");

    lines.push("### Recommandations");
    lines.push("");
    for (const r of s.recommendations) {
      lines.push(`- ${r}`);
    }
    lines.push("");

    lines.push(`### 1. Candidats pré-scoring (${s.preScoring.total})`);
    lines.push("");
    lines.push("Après filtres : compétence, niveau ±1, format autorisé, contenu utilisable.");
    lines.push("");
    lines.push(`**Par statut validation :** ${fmtDist(s.preScoring.by_status)}`);
    lines.push(`**Par niveau :** ${fmtDist(s.preScoring.by_niveau)}`);
    lines.push(`**Par thème canonique :** ${fmtDist(s.preScoring.by_theme)}`);
    lines.push(`**Par format :** ${fmtDist(s.preScoring.by_format)}`);
    lines.push("");

    if (s.preScoring.candidates.length > 0) {
      lines.push("| ID (8) | Titre | Niv. | Thème | Format | Statut | Score est. | Règles |");
      lines.push("|--------|-------|------|-------|--------|--------|------------|--------|");
      for (const c of s.preScoring.candidates) {
        const idShort = c.exercice_id.slice(0, 8);
        const titre = (c.titre ?? "—").slice(0, 40);
        lines.push(
          `| ${idShort} | ${titre} | ${c.niveau_vise ?? "—"} | ${c.theme_canonical ?? c.theme ?? "—"} | ${c.format ?? "—"} | ${c.validation_status} | ${c.estimated_score} | ${c.matched_rules.join(", ") || "—"} |`,
        );
      }
      lines.push("");
    } else {
      lines.push("_Aucun candidat après filtres dimensionnels._");
      lines.push("");
    }

    lines.push(`### 2. VA exclus par score bas (${s.scoreLow.length})`);
    lines.push("");
    if (s.scoreLow.length > 0) {
      lines.push("| ID (8) | Titre | Niv. | Comp. | Thème | Format | Statut | Score | Raison | Détail |");
      lines.push("|--------|-------|------|-------|-------|--------|--------|-------|--------|--------|");
      for (const c of s.scoreLow) {
        const idShort = c.exercice_id.slice(0, 8);
        const titre = (c.titre ?? "—").slice(0, 35);
        lines.push(
          `| ${idShort} | ${titre} | ${c.niveau_vise ?? "—"} | ${c.competence ?? "—"} | ${c.theme_canonical ?? c.theme ?? "—"} | ${c.format ?? "—"} | ${c.validation_status} | ${c.estimated_score} | ${c.exclusion_reason} | ${c.exclusion_detail} |`,
        );
      }
      lines.push("");
    } else {
      lines.push("_Aucun VA exclu par score bas._");
      lines.push("");
    }

    if (s.otherPostDimExclusions.length > 0) {
      lines.push(`### NR post-filtres (${s.otherPostDimExclusions.length})`);
      lines.push("");
      const nrByTier = groupCount(s.otherPostDimExclusions, "nr_tier");
      lines.push(`Répartition tiers : ${fmtDist(nrByTier)}`);
      lines.push("");
    }

    if (s.report.retained.length > 0) {
      lines.push("### Retenus");
      lines.push("");
      lines.push("| ID (8) | Titre | Niv. | Thème | Score | Tier |");
      lines.push("|--------|-------|------|-------|-------|------|");
      for (const r of s.report.retained) {
        lines.push(
          `| ${r.exercice_id.slice(0, 8)} | ${(r.titre ?? "—").slice(0, 35)} | ${r.niveau_vise ?? "—"} | ${r.theme ?? "—"} | ${r.score} | ${r.selection_tier} |`,
        );
      }
      lines.push("");
    }
  }

  lines.push("---", "");
  lines.push(
    "_Rapport généré par `scripts/pre-session-generation-need-diagnosis.mjs` — diagnostic read-only generation_need._",
  );
  return lines.join("\n");
}

function fmtDist(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
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

  console.log("Chargement banque (read-only)...");
  const candidates = await fetchPreSessionBankCandidates(supabase);
  console.log(`Banque : ${candidates.length} exercices.`);

  const scenarios = [];
  for (const scenario of GENERATION_NEED_SCENARIOS) {
    const diag = diagnoseScenario(scenario, candidates);
    const entry = {
      id: scenario.id,
      label: scenario.label,
      expected_outcome: scenario.outcome,
      params: {
        niveauVise: scenario.niveauVise,
        competence: scenario.competence,
        themeId: scenario.themeId,
        quota: scenario.quota,
      },
      ...diag,
      recommendations: recommendFix(scenario, diag),
    };
    scenarios.push(entry);
    console.log(
      `[${scenario.id}] pre=${diag.preScoring.total} VA=${diag.vaInBank} score_low=${diag.scoreLow.length} P1=${diag.p1Pool} → ${diag.classification.primary}`,
    );
  }

  const bundle = {
    generated_at: new Date().toISOString(),
    commit_ref: getCommitRef(),
    bank_total: candidates.length,
    reuse_score_min: REUSE_SCORE_MIN,
    scenarios,
  };

  const mdPath = resolve(ROOT, "docs", "pre-session-generation-need-diagnosis.md");
  await writeFile(mdPath, buildMarkdown(bundle), "utf8");
  console.log(`Rapport écrit : ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
