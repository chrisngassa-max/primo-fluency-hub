/**
 * pre-session-bank-recovery-audit.mjs — Mini-lot récupération banque (READ ONLY).
 * Identifie candidats backfill thème prefecture et promotion approved_human.
 *
 * USAGE :
 *   node --import tsx scripts/pre-session-bank-recovery-audit.mjs
 *
 * INTERDIT : backfill apply, changement validation_status, génération IA.
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

const ADMIN_KEYWORD_PATTERNS = [
  { label: "prefecture", test: (t) => t.includes("prefecture") },
  { label: "titre de sejour", test: (t) => t.includes("titre de sejour") },
  { label: "titre de séjour", test: (t) => t.includes("titre de sejour") },
  { label: "mairie", test: (t) => /\bmairie\b/.test(t) },
  { label: "ofii", test: (t) => /\bofii\b/.test(t) },
  { label: "recepisse", test: (t) => t.includes("recepisse") },
  { label: "récépissé", test: (t) => t.includes("recepisse") },
  { label: "convocation", test: (t) => t.includes("convocation") },
  { label: "dossier", test: (t) => /\bdossier\b/.test(t) },
  { label: "document administratif", test: (t) => t.includes("document administratif") },
  { label: "demarche administrative", test: (t) => t.includes("demarche administrative") },
  { label: "démarche administrative", test: (t) => t.includes("demarche administrative") },
  { label: "demande administrative", test: (t) => t.includes("demande administrative") },
  { label: "demandes administratives", test: (t) => t.includes("demande administrative") },
  { label: "documents administratifs", test: (t) => t.includes("document administratif") },
  { label: "demarches administratives", test: (t) => t.includes("demarche administrative") },
  { label: "démarches administratives", test: (t) => t.includes("demarche administrative") },
  { label: "procedure administrative", test: (t) => t.includes("procedure administrative") },
  { label: "procédure administrative", test: (t) => t.includes("procedure administrative") },
  { label: "caf (organisme)", test: (t) => /\bcaf\b/.test(t) || t.includes("caisse d allocations") },
  { label: "administratif", test: (t) => t.includes("administratif") || t.includes("administrative") },
];

const STRONG_ADMIN_LABELS = new Set([
  "prefecture",
  "préfecture",
  "titre de sejour",
  "titre de séjour",
  "mairie",
  "ofii",
  "recepisse",
  "récépissé",
  "convocation",
  "document administratif",
  "demarche administrative",
  "démarche administrative",
  "demande administrative",
  "demandes administratives",
  "documents administratifs",
  "demarches administratives",
  "démarches administratives",
  "procedure administrative",
  "procédure administrative",
  "caf (organisme)",
]);

const CORRECTION_WARNING_CODES = new Set(["ambiguous_correction", "correction_not_in_text"]);

const SCENARIO_A2 = {
  id: "S2",
  label: "A2 / CO / prefecture / quota 5",
  niveauVise: "A2",
  competence: "CO",
  themeId: "prefecture",
  quota: 5,
};

const SCENARIO_B1 = {
  id: "S3",
  label: "B1 / CO / prefecture / quota 5",
  niveauVise: "B1",
  competence: "CO",
  themeId: "prefecture",
  quota: 5,
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

function getCommitRef() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function normalizeText(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function collectRowText(row) {
  const parts = [row.titre, row.consigne, row.contexte_irn];
  if (row.contenu != null) {
    try {
      parts.push(typeof row.contenu === "string" ? row.contenu : JSON.stringify(row.contenu));
    } catch {
      parts.push(String(row.contenu));
    }
  }
  return normalizeText(parts.filter(Boolean).join(" "));
}

function matchAdminKeywords(text) {
  const normalized = normalizeText(text);
  const hits = [];
  for (const { label, test } of ADMIN_KEYWORD_PATTERNS) {
    if (test(normalized)) hits.push(label);
  }
  return hits;
}

function isLikelyPrefectureBackfill(keywordHits) {
  if (keywordHits.some((h) => STRONG_ADMIN_LABELS.has(h))) return true;
  return keywordHits.includes("dossier") && keywordHits.some((h) => h.includes("administratif"));
}

function scoreForScenario(row, scenario) {
  const target = {
    competence: scenario.competence,
    niveauVise: scenario.niveauVise,
    themeId: scenario.themeId,
    typeDemarche: "titre_sejour",
  };
  const ctx = buildScoringContexts(target);
  const targetThemeId = canonicalizeTheme(scenario.themeId);
  return scoreCandidateWithTheme(mapRowToScoringExercise(row, target), ctx, targetThemeId);
}

function scoreWithThemeBackfill(row, scenario, theme = "prefecture") {
  const patched = { ...row, theme };
  return scoreForScenario(patched, scenario);
}

function passesDimFilters(row, scenario) {
  if (row.competence !== scenario.competence) return false;
  const niveaux = new Set(niveauWindow(scenario.niveauVise).map((n) => n.toUpperCase()));
  const niveau = String(row.niveau_vise ?? "").toUpperCase();
  if (!niveaux.has(niveau)) return false;
  const allowedFormats = formatsAutorisesForCompetence(scenario.competence);
  const format = String(row.format ?? "");
  if (format && allowedFormats.size > 0 && !allowedFormats.has(format)) return false;
  return hasUsableContent(row);
}

function summarizeIssues(issues) {
  if (!issues?.length) return "—";
  return issues
    .map((i) => `${i.code}(${i.severity}${i.layer ? `/${i.layer}` : ""})`)
    .join("; ");
}

function mainIssueCodes(issues) {
  const errors = (issues ?? []).filter((i) => i.severity === "error").map((i) => i.code);
  const warnings = (issues ?? []).filter((i) => i.severity === "warning").map((i) => i.code);
  if (errors.length) return errors.slice(0, 3);
  return warnings.slice(0, 3);
}

function reviewPriority(tier, issues, niveau) {
  if (tier === "vert") return "P2";
  if (tier === "orange") return "P1";
  const codes = new Set((issues ?? []).map((i) => i.code));
  if (codes.has("level_doubtful")) return "P0";
  if ([...codes].some((c) => CORRECTION_WARNING_CODES.has(c))) return "P0";
  if (niveau === "B1") return "P1";
  return "P1";
}

function recommendNrAction(row, tier, issues, scoreA2, scoreB1) {
  const codes = new Set((issues ?? []).map((i) => i.code));
  const hasError = (issues ?? []).some((i) => i.severity === "error");

  if (hasError) return "rejected";
  if (codes.has("level_doubtful")) return "needs_review";
  if ([...codes].some((c) => CORRECTION_WARNING_CODES.has(c))) return "needs_review";

  const hasL7 = (issues ?? []).some(
    (i) => CORRECTION_WARNING_CODES.has(i.code) || i.layer === "L7_correction",
  );
  const onlyAudioAndL6 =
    !hasL7 &&
    (issues ?? []).every(
      (i) =>
        i.code === "missing_audio_script" ||
        i.code === "consigne_too_long" ||
        i.code.startsWith("consigne_too_long") ||
        i.code === "feedback_too_long",
    );

  const niveau = String(row.niveau_vise ?? "").toUpperCase();
  const relevantScore = niveau === "B1" ? scoreB1.score : scoreA2.score;

  if (tier === "vert" && relevantScore >= REUSE_SCORE_MIN) return "approved_human";
  if (onlyAudioAndL6 && relevantScore >= REUSE_SCORE_MIN) return "approved_human";
  if (tier === "orange") return "needs_review";

  const onlyL6 =
    (issues ?? []).length > 0 &&
    (issues ?? []).every(
      (i) =>
        i.severity === "warning" &&
        (i.code === "consigne_too_long" ||
          i.code.startsWith("consigne_too_long") ||
          i.code === "feedback_too_long"),
    );
  if (onlyL6 && relevantScore >= REUSE_SCORE_MIN) return "approved_human";

  return "needs_review";
}

function simulateScenario(candidates, scenario, backfillIds = new Set(), promotedIds = new Set()) {
  const patched = candidates.map((c) => {
    let copy = { ...c };
    if (backfillIds.has(c.id)) copy = { ...copy, theme: "prefecture" };
    if (promotedIds.has(c.id)) copy = { ...copy, validation_status: "approved_human" };
    return copy;
  });
  return preSessionSelectExercises(patched, {
    niveauVise: scenario.niveauVise,
    competence: scenario.competence,
    themeId: scenario.themeId,
    quota: scenario.quota,
  });
}

function buildMarkdown(bundle) {
  const lines = [];
  const { backfillCandidates, nrPromotionCandidates, impact, goNoGo } = bundle;

  lines.push("# Rapport mini-lot récupération banque — préfecture CO");
  lines.push("");
  lines.push(`**Généré :** ${bundle.generated_at}`);
  lines.push(`**Commit :** ${bundle.commit_ref}`);
  lines.push("**Mode :** read-only — 0 écriture Supabase, 0 backfill appliqué, 0 génération");
  lines.push(`**Banque lue :** ${bundle.bank_total} exercices`);
  lines.push(`**Seuil réutilisation :** REUSE_SCORE_MIN = ${REUSE_SCORE_MIN}`);
  lines.push("");

  lines.push("## Synthèse exécutive (FR)");
  lines.push("");
  lines.push("| Lot | Candidats | Action |");
  lines.push("|-----|-----------|--------|");
  lines.push(
    `| Backfill \`theme=prefecture\` | ${backfillCandidates.length} VA | Métadonnées seules — gain scoring immédiat |`,
  );
  lines.push(
    `| Promotion \`approved_human\` | ${nrPromotionCandidates.filter((c) => c.recommendation === "approved_human").length} NR recommandés | Débloquer repli sensible préfecture B1/A2 |`,
  );
  lines.push("");
  lines.push(`**Verdict lot :** ${goNoGo.verdict} — ${goNoGo.summary}`);
  lines.push("");

  lines.push("## 1. Candidats backfill `theme=prefecture`");
  lines.push("");
  lines.push(
    "Critères : CO, niveau A2/B1, `validated_auto`, score 60 vs scénario préfecture, thème absent, texte administratif (mots-clés préfecture/mairie/OFII/dossier…).",
  );
  lines.push("");
  if (backfillCandidates.length === 0) {
    lines.push("_Aucun candidat VA éligible._");
  } else {
    lines.push(
      "| ID | Titre | Niv. | Thème actuel | Justification | Score actuel | Score après backfill (B1) | Score après backfill (A2) |",
    );
    lines.push(
      "|----|-------|------|--------------|---------------|--------------|---------------------------|---------------------------|",
    );
    for (const c of backfillCandidates) {
      lines.push(
        `| \`${c.id.slice(0, 8)}\` | ${(c.titre ?? "—").slice(0, 45)} | ${c.niveau} | ${c.theme_actuel ?? "—"} | ${c.justification} | ${c.score_actuel_b1 ?? c.score_actuel} | ${c.score_apres_b1} | ${c.score_apres_a2} |`,
      );
    }
  }
  lines.push("");

  lines.push("## 2. Candidats promotion `approved_human` (NR préfecture A2/B1, score 100)");
  lines.push("");
  lines.push(
    "Critères : `needs_review`, thème canonique `prefecture`, niveau A2 ou B1, CO, score ≥ 80 vs scénario cible.",
  );
  lines.push("");
  if (nrPromotionCandidates.length === 0) {
    lines.push("_Aucun NR préfecture A2/B1 à score 100._");
  } else {
    lines.push(
      "| ID | Titre | Niv. | Comp. | Tier NR | Issues principales | Priorité | Recommandation | Score B1 | Score A2 |",
    );
    lines.push(
      "|----|-------|------|-------|---------|-------------------|----------|----------------|----------|----------|",
    );
    for (const c of nrPromotionCandidates) {
      lines.push(
        `| \`${c.id.slice(0, 8)}\` | ${(c.titre ?? "—").slice(0, 40)} | ${c.niveau} | ${c.competence} | ${c.nr_tier} | ${c.main_issues} | ${c.priority} | **${c.recommendation}** | ${c.score_b1} | ${c.score_a2} |`,
      );
    }
  }
  lines.push("");

  lines.push("## 3. Impact attendu sur scénarios pré-session");
  lines.push("");

  for (const sc of impact.scenarios) {
    lines.push(`### ${sc.id} — ${sc.label}`);
    lines.push("");
    lines.push("| Étape | Retenus | Gap | P1 pool |");
    lines.push("|-------|---------|-----|---------|");
    lines.push(
      `| Baseline (actuel) | ${sc.baseline.retained}/${sc.quota} | ${sc.baseline.gap} | ${sc.baseline.p1_pool} |`,
    );
    lines.push(
      `| Après backfill seul | ${sc.after_backfill.retained}/${sc.quota} | ${sc.after_backfill.gap} | ${sc.after_backfill.p1_pool} |`,
    );
    lines.push(
      `| Après backfill + promotions recommandées | ${sc.after_full.retained}/${sc.quota} | ${sc.after_full.gap} | ${sc.after_full.p1_pool} |`,
    );
    lines.push("");
    lines.push(`- **Génération résiduelle :** ${sc.generation_residual}`);
    lines.push("");
  }

  lines.push("## 4. Génération encore nécessaire après recovery");
  lines.push("");
  for (const item of impact.post_recovery_gaps) {
    lines.push(`- **${item.scenario}** : ${item.detail}`);
  }
  lines.push("");
  lines.push("*(Hors périmètre mini-lot : B2 CE, B2 Structures, B1 EE — vrais trous banque / validation P0.)*");
  lines.push("");

  lines.push("## 5. GO / NO-GO — lot correction métadonnées / validation");
  lines.push("");
  lines.push(`### Verdict : **${goNoGo.verdict}**`);
  lines.push("");
  lines.push(goNoGo.rationale);
  lines.push("");
  lines.push("### Critères");
  lines.push("");
  for (const c of goNoGo.criteria) {
    lines.push(`- [${c.pass ? "x" : " "}] ${c.label} — ${c.detail}`);
  }
  lines.push("");
  lines.push("### Plan d'exécution recommandé (sans exécution dans ce rapport)");
  lines.push("");
  for (const step of goNoGo.plan) {
    lines.push(`${step.n}. ${step.action} (${step.count} exercice(s))`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "_Rapport généré par `scripts/pre-session-bank-recovery-audit.mjs` — audit read-only mini-lot récupération banque._",
  );
  return lines.join("\n");
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

  const backfillCandidates = [];
  for (const row of candidates) {
    if (row.competence !== "CO") continue;
    const niveau = String(row.niveau_vise ?? "").toUpperCase();
    if (niveau !== "A2" && niveau !== "B1") continue;
    if (row.validation_status !== "validated_auto") continue;
    if (canonicalizeTheme(row.theme) !== null) continue;

    const text = collectRowText(row);
    const keywordHits = matchAdminKeywords(text);
    if (keywordHits.length === 0 || !isLikelyPrefectureBackfill(keywordHits)) continue;

    const scoreB1Now = scoreForScenario(row, SCENARIO_B1);
    const scoreA2Now = scoreForScenario(row, SCENARIO_A2);
    const scoreNow = niveau === "B1" ? scoreB1Now.score : scoreA2Now.score;
    if (scoreNow !== 60) continue;

    const scoreB1After = scoreWithThemeBackfill(row, SCENARIO_B1);
    const scoreA2After = scoreWithThemeBackfill(row, SCENARIO_A2);

    backfillCandidates.push({
      id: row.id,
      titre: row.titre,
      niveau,
      theme_actuel: row.theme,
      keyword_hits: keywordHits,
      justification: `Mots-clés : ${keywordHits.slice(0, 4).join(", ")}${keywordHits.length > 4 ? "…" : ""}`,
      score_actuel: scoreNow,
      score_actuel_b1: scoreB1Now.score,
      score_apres_b1: scoreB1After.score,
      score_apres_a2: scoreA2After.score,
    });
  }

  backfillCandidates.sort((a, b) => a.niveau.localeCompare(b.niveau) || b.score_apres_b1 - a.score_apres_b1);

  const nrPromotionCandidates = [];
  for (const row of candidates) {
    if (row.competence !== "CO") continue;
    if (row.validation_status !== "needs_review") continue;
    const niveau = String(row.niveau_vise ?? "").toUpperCase();
    if (niveau !== "A2" && niveau !== "B1") continue;
    if (canonicalizeTheme(row.theme) !== "prefecture") continue;

    const scoreB1 = scoreForScenario(row, SCENARIO_B1);
    const scoreA2 = scoreForScenario(row, SCENARIO_A2);
    const relevantScore = niveau === "B1" ? scoreB1.score : scoreA2.score;
    if (relevantScore < REUSE_SCORE_MIN) continue;

    const tier = classifyNrTier(row.validation_issues, row.theme);
    const recommendation = recommendNrAction(row, tier, row.validation_issues, scoreA2, scoreB1);

    nrPromotionCandidates.push({
      id: row.id,
      titre: row.titre,
      niveau,
      competence: row.competence,
      nr_tier: tier,
      main_issues: summarizeIssues(row.validation_issues),
      issue_codes: mainIssueCodes(row.validation_issues),
      priority: reviewPriority(tier, row.validation_issues, niveau),
      recommendation,
      score_b1: scoreB1.score,
      score_a2: scoreA2.score,
      validation_issues: row.validation_issues ?? [],
    });
  }

  nrPromotionCandidates.sort((a, b) => {
    const prio = { P0: 0, P1: 1, P2: 2 };
    const pd = (prio[a.priority] ?? 9) - (prio[b.priority] ?? 9);
    if (pd !== 0) return pd;
    if (a.recommendation === "approved_human" && b.recommendation !== "approved_human") return -1;
    if (b.recommendation === "approved_human" && a.recommendation !== "approved_human") return 1;
    return b.score_b1 - a.score_b1;
  });

  const backfillIds = new Set(backfillCandidates.map((c) => c.id));
  const promoteIds = new Set(
    nrPromotionCandidates.filter((c) => c.recommendation === "approved_human").map((c) => c.id),
  );

  function snapshot(report, quota) {
    const gap = report.remaining_gaps[0]?.gap ?? quota;
    return {
      retained: report.retained.length,
      gap,
      p1_pool: report.meta.p1_pool,
      generation_reason: report.generation_need.slots[0]?.reason ?? null,
    };
  }

  const impactScenarios = [];
  for (const scenario of [SCENARIO_A2, SCENARIO_B1]) {
    const baseline = preSessionSelectExercises(candidates, {
      niveauVise: scenario.niveauVise,
      competence: scenario.competence,
      themeId: scenario.themeId,
      quota: scenario.quota,
    });
    const afterBackfill = simulateScenario(candidates, scenario, backfillIds, new Set());
    const afterFull = simulateScenario(candidates, scenario, backfillIds, promoteIds);

    const b = snapshot(baseline, scenario.quota);
    const ab = snapshot(afterBackfill, scenario.quota);
    const af = snapshot(afterFull, scenario.quota);

    let generationResidual;
    if (af.gap === 0) generationResidual = "Aucune — quota couvert après recovery.";
    else if (af.gap === 1)
      generationResidual = `1 exercice CO ${scenario.niveauVise} préfecture (PARTIAL_GAP résiduel).`;
    else generationResidual = `${af.gap} exercices CO ${scenario.niveauVise} préfecture.`;

    impactScenarios.push({
      id: scenario.id,
      label: scenario.label,
      quota: scenario.quota,
      baseline: b,
      after_backfill: ab,
      after_full: af,
      generation_residual: generationResidual,
    });
  }

  const approvedCount = nrPromotionCandidates.filter((c) => c.recommendation === "approved_human").length;
  const b1AfterFull = impactScenarios.find((s) => s.id === "S3");
  const a2AfterFull = impactScenarios.find((s) => s.id === "S2");

  const goNoGo = {
    verdict: "GO",
    summary: "",
    rationale: "",
    criteria: [],
    plan: [],
  };

  const coversB1 = (b1AfterFull?.after_full.gap ?? 5) === 0;
  const coversA2 = (a2AfterFull?.after_full.gap ?? 1) === 0;
  const backfillGainB1 = (b1AfterFull?.after_backfill.p1_pool ?? 0) - (b1AfterFull?.baseline.p1_pool ?? 0);

  goNoGo.criteria = [
    {
      pass: backfillCandidates.length > 0,
      label: "Candidats backfill VA identifiés et justifiés",
      detail: `${backfillCandidates.length} exercice(s) VA CO A2/B1 sans thème, score 60, texte administratif`,
    },
    {
      pass: nrPromotionCandidates.length >= 5,
      label: "Pool NR préfecture A2/B1 score 100 disponible",
      detail: `${nrPromotionCandidates.length} NR éligibles (${approvedCount} promotion approved_human recommandée)`,
    },
    {
      pass: backfillGainB1 > 0 || backfillCandidates.some((c) => c.score_apres_b1 >= REUSE_SCORE_MIN),
      label: "Backfill thème améliore le scoring B1 CO préfecture",
      detail: `P1 pool B1 : ${b1AfterFull?.baseline.p1_pool} → ${b1AfterFull?.after_backfill.p1_pool} après backfill`,
    },
    {
      pass: (b1AfterFull?.after_full.gap ?? 5) <= 2,
      label: "Recovery réduit le gap B1 sous seuil génération massive",
      detail: `Gap B1 : ${b1AfterFull?.baseline.gap} → ${b1AfterFull?.after_full.gap} après backfill + promotions`,
    },
    {
      pass: !coversA2 || approvedCount >= 1,
      label: "Stratégie A2 CO préfecture adressée (promotion NR ou génération ciblée)",
      detail: coversA2
        ? "Quota A2 couvert après recovery"
        : `Gap A2 résiduel ${a2AfterFull?.after_full.gap} — ${approvedCount} NR A2 promotables`,
    },
  ];

  const allCriteriaPass = goNoGo.criteria.every((c) => c.pass);
  goNoGo.verdict = allCriteriaPass ? "GO" : "GO CONDITIONNEL";

  goNoGo.summary = allCriteriaPass
    ? "Lot métadonnées + validation préfecture CO justifié avant toute génération B1/A2."
    : "Lot partiellement justifié — exécuter backfill + revue ciblée NR, puis réévaluer gap résiduel.";

  goNoGo.rationale = [
    `Le mini-lot adresse un **problème de métadonnées/scoring**, pas un trou banque pur : ${backfillCandidates.length} VA bloqués à score 60 par absence de thème, ${nrPromotionCandidates.length} NR préfecture A2/B1 déjà à score 100 mais exclus (tier rouge + thème sensible).`,
    `Après backfill seul : S3 B1 passe de ${b1AfterFull?.baseline.retained}/${SCENARIO_B1.quota} à ${b1AfterFull?.after_backfill.retained}/${SCENARIO_B1.quota} retenus (P1=${b1AfterFull?.after_backfill.p1_pool}).`,
    `Après backfill + ${approvedCount} promotions \`approved_human\` : S3 ${b1AfterFull?.after_full.retained}/${SCENARIO_B1.quota}, S2 ${a2AfterFull?.after_full.retained}/${SCENARIO_A2.quota}.`,
    coversB1 && coversA2
      ? "Les deux scénarios CO préfecture A2/B1 seraient couverts sans génération."
      : "Génération ciblée reste nécessaire sur les gaps résiduels (voir §4).",
  ].join("\n\n");

  goNoGo.plan = [
    {
      n: 1,
      action: "Backfill `theme='prefecture'` (dry-run validé par ce rapport)",
      count: backfillCandidates.length,
    },
    {
      n: 2,
      action: "Revue humaine NR → `approved_human` (priorité P0/P1)",
      count: approvedCount,
    },
    {
      n: 3,
      action: "Revue NR → `needs_review` (corrections L7/L6 avant promotion)",
      count: nrPromotionCandidates.filter((c) => c.recommendation === "needs_review").length,
    },
    {
      n: 4,
      action: "Génération ciblée post-recovery (si gap résiduel > 0)",
      count: Math.max(b1AfterFull?.after_full.gap ?? 0, a2AfterFull?.after_full.gap ?? 0),
    },
  ];

  const bundle = {
    generated_at: new Date().toISOString(),
    commit_ref: getCommitRef(),
    bank_total: candidates.length,
    backfillCandidates,
    nrPromotionCandidates,
    impact: {
      scenarios: impactScenarios,
      post_recovery_gaps: [
        {
          scenario: "S3 B1 CO préfecture",
          detail: b1AfterFull?.generation_residual ?? "—",
        },
        {
          scenario: "S2 A2 CO préfecture",
          detail: a2AfterFull?.generation_residual ?? "—",
        },
        {
          scenario: "S4 B2 CE",
          detail: "5 exercices — 0 VA, génération Lot 8 P0 (hors mini-lot)",
        },
        {
          scenario: "S7 B2 Structures",
          detail: "5 exercices — 0 candidat dimensionnel, génération intégrale (hors mini-lot)",
        },
        {
          scenario: "S6 B1 EE",
          detail: "4 exercices — trou niveau B1 + score A2, génération P0 (hors mini-lot)",
        },
      ],
    },
    goNoGo,
  };

  const mdPath = resolve(ROOT, "docs", "bank-recovery-mini-lot-report.md");
  await writeFile(mdPath, buildMarkdown(bundle), "utf8");
  console.log(`Rapport écrit : ${mdPath}`);
  console.log(
    `Backfill=${backfillCandidates.length} NR=${nrPromotionCandidates.length} approved_rec=${approvedCount} GO=${goNoGo.verdict}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
