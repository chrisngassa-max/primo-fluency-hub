#!/usr/bin/env node
/**
 * CAPTCF Lot 0.7 — future-proof security guards (local, no secrets).
 *
 * Distinguishes three layers:
 *   1) repo / migrations state
 *   2) optional observed remote evidence JSON (never prints keys)
 *   3) latent DEFAULT PRIVILEGES risk (system role)
 *
 * Usage:
 *   node scripts/security/assert-lot07-future-guards.mjs
 *   node scripts/security/assert-lot07-future-guards.mjs --evidence .local-security-evidence/lot07-remote.json
 *
 * Exit 1 on failure. Never requires or prints API keys.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];
const args = process.argv.slice(2);
const evidenceIdx = args.indexOf("--evidence");
const evidencePath =
  evidenceIdx >= 0 ? path.resolve(args[evidenceIdx + 1] || "") : null;

const SENSITIVE_TABLES = [
  "profiles",
  "user_roles",
  "group_members",
  "resultats",
  "devoirs",
  "placement_test_attempts",
  "placement_test_results",
  "pedagogical_source_transcriptions",
  "readiness_snapshots",
];

const ACCOUNT_FN_SLUGS = [
  "bootstrap-test-accounts",
  "create-formateur-account",
];

function section(title) {
  console.log(`\n== ${title} ==`);
}

function readUtf8(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function listMigrations() {
  const dir = path.join(root, "supabase", "migrations");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** Layer 1 — repository / migrations */
function checkRepo() {
  section("1) Repo / migrations");

  for (const slug of ACCOUNT_FN_SLUGS) {
    const fn = readUtf8(path.join("supabase", "functions", slug, "index.ts"));
    if (/createUser\s*\(/.test(fn)) {
      failures.push(`${slug}: contains createUser()`);
    }
    if (/password\s*:\s*["'`]/.test(fn) || /CapTcf2025/.test(fn)) {
      failures.push(`${slug}: appears to embed hardcoded passwords`);
    }
    if (!/\b410\b/.test(fn)) {
      failures.push(`${slug}: must return HTTP 410 when disabled`);
    }

    const cfg = readUtf8("supabase/config.toml");
    const re = new RegExp(
      `\\[functions\\.${slug.replace(/[-]/g, "\\-")}\\]\\s*\\n([^\\[]*)`,
    );
    const block = cfg.match(re);
    if (!block) {
      failures.push(`config.toml missing [functions.${slug}]`);
    } else {
      const jwtLine = block[1]
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .find((l) => l.startsWith("verify_jwt"));
      if (!jwtLine || !/verify_jwt\s*=\s*true/.test(jwtLine)) {
        failures.push(`${slug}: verify_jwt must be true in config.toml`);
      }
      if (jwtLine && /verify_jwt\s*=\s*false/.test(jwtLine)) {
        failures.push(`${slug}: verify_jwt must not be false`);
      }
    }
  }

  const migFiles = listMigrations();
  const lot05 = migFiles.find((f) => f.includes("lot05_confine_placement"));
  const lot06 = migFiles.find((f) => f.includes("lot06_confine_global_anon"));
  if (!lot05) failures.push("missing lot05 placement confinement migration");
  if (!lot06) failures.push("missing lot06 global anon confinement migration");

  if (lot06) {
    const mig = readUtf8(path.join("supabase", "migrations", lot06));
    if (!/REVOKE ALL ON TABLE public\.%I FROM anon/.test(mig)) {
      failures.push("lot06 migration must REVOKE ALL from anon on public tables");
    }
  }

  // Post-lot06 migrations that CREATE TABLE must harden anon + declare GRANTs
  const postLot06 = migFiles.filter((f) => {
    const ts = f.slice(0, 14);
    return /^\d{14}$/.test(ts) && ts > "20260917195043";
  });

  for (const file of postLot06) {
    const sql = readUtf8(path.join("supabase", "migrations", file));
    const createsTable = /CREATE\s+TABLE\b/i.test(sql);
    if (!createsTable) continue;

    const hasExplicitGrant = /GRANT\b/i.test(sql);
    const revokesAnon =
      /REVOKE\b[\s\S]{0,120}\bFROM\s+anon\b/i.test(sql) ||
      /REVOKE\s+ALL\b[\s\S]{0,80}\banon\b/i.test(sql);
    const enablesRls = /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql);
    const hasPolicy = /CREATE\s+POLICY\b/i.test(sql);
    const policyMissingTo =
      hasPolicy &&
      /CREATE\s+POLICY\b[\s\S]{0,200}?ON\b/i.test(sql) &&
      !/CREATE\s+POLICY\b[\s\S]{0,400}?\bTO\s+(authenticated|service_role|anon)\b/i.test(
        sql,
      );

    if (!hasExplicitGrant) {
      failures.push(
        `${file}: new table migration must declare explicit GRANT (contribution rule)`,
      );
    }
    if (!revokesAnon) {
      // Latent DEFAULT PRIVILEGES (supabase_admin) make this mandatory
      failures.push(
        `${file}: new table migration must REVOKE dangerous privileges from anon (DEFAULT PRIVILEGES residual)`,
      );
    }
    if (hasPolicy && !enablesRls) {
      failures.push(`${file}: policies present but RLS not enabled`);
    }
    if (policyMissingTo) {
      failures.push(
        `${file}: CREATE POLICY must use explicit TO (authenticated|service_role|anon)`,
      );
    }

    // Manifestly permissive anonymous/public policies in new migrations
    if (
      /CREATE\s+POLICY\b[\s\S]{0,500}?(USING|WITH\s+CHECK)\s*\(\s*true\s*\)/i.test(
        sql,
      ) &&
      !/\bTO\s+service_role\b/i.test(sql)
    ) {
      failures.push(
        `${file}: manifestly permissive policy USING/CHECK (true) without TO service_role`,
      );
    }
  }

  console.log(
    `Checked account stubs, lot05/06 presence, ${postLot06.length} post-lot06 migration(s)`,
  );
}

/** Layer 2 — observed remote evidence (optional JSON, no secrets) */
function checkRemoteEvidence() {
  section("2) Observed remote state");

  if (!evidencePath) {
    console.log(
      "Skipped (pass --evidence <json> for remote assertions). SQL companion: supabase/tests/lot07_future_guards.sql",
    );
    return;
  }

  if (!fs.existsSync(evidencePath)) {
    failures.push(`evidence file not found: ${evidencePath}`);
    return;
  }

  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  } catch {
    failures.push(`evidence file is not valid JSON: ${evidencePath}`);
    return;
  }

  // Never echo secrets if present by mistake
  for (const key of Object.keys(evidence)) {
    if (/key|secret|password|token|service_role/i.test(key)) {
      failures.push(
        `evidence must not contain secret-like field names (found: ${key})`,
      );
    }
  }

  const anonPriv = evidence.anon_table_privilege_count;
  if (typeof anonPriv === "number") {
    if (anonPriv !== 0) {
      failures.push(
        `remote: anon still has ${anonPriv} table privilege grant(s) in public`,
      );
    } else {
      console.log("remote: anon table privileges = 0");
    }
  } else {
    warnings.push("evidence missing anon_table_privilege_count");
  }

  const dangerous = evidence.anon_dangerous_privilege_tables || [];
  if (Array.isArray(dangerous) && dangerous.length) {
    failures.push(
      `remote: anon has TRUNCATE/DELETE/REFERENCES/TRIGGER on: ${dangerous.join(", ")}`,
    );
  }

  const sensitiveHits = evidence.anon_sensitive_access || [];
  if (Array.isArray(sensitiveHits) && sensitiveHits.length) {
    failures.push(
      `remote: anon can access sensitive tables: ${sensitiveHits.join(", ")}`,
    );
  }

  const permissive = evidence.manifestly_permissive_policies || [];
  if (Array.isArray(permissive) && permissive.length) {
    failures.push(
      `remote: manifestly permissive public/anon policies: ${permissive
        .map((p) => (typeof p === "string" ? p : `${p.table}.${p.policy}`))
        .join("; ")}`,
    );
  }

  const sandbox = evidence.sandbox_isolation_open_policies || [];
  if (Array.isArray(sandbox) && sandbox.length) {
    // Active authenticated exposure — fail closed (Lot 0.7 ARRÊT criterion)
    failures.push(
      `remote: Sandbox isolation policies open non-sandbox rows to {public} roles (${sandbox.length}) — requires Lot 2A authorization`,
    );
  }

  const stubs = evidence.account_function_stubs || {};
  for (const slug of ACCOUNT_FN_SLUGS) {
    const st = stubs[slug];
    if (!st) {
      warnings.push(`evidence missing account_function_stubs.${slug}`);
      continue;
    }
    if (st.verify_jwt !== true) {
      failures.push(`remote: ${slug} verify_jwt is not true`);
    }
  }

  console.log(`Evidence loaded from ${path.relative(root, evidencePath)}`);
}

/** Layer 3 — latent DEFAULT PRIVILEGES risk (documented expectation) */
function checkLatentDefaultPrivileges() {
  section("3) Latent DEFAULT PRIVILEGES risk");

  // Repo cannot mutate supabase_admin defaults; enforce that docs/tests acknowledge residual.
  const testPath = path.join(
    root,
    "supabase",
    "tests",
    "lot07_future_guards.sql",
  );
  if (!fs.existsSync(testPath)) {
    failures.push("missing supabase/tests/lot07_future_guards.sql");
    return;
  }
  const sql = fs.readFileSync(testPath, "utf8");
  if (!/supabase_admin/i.test(sql) || !/DEFAULT PRIVILEGES/i.test(sql)) {
    failures.push(
      "lot07 SQL test must document/assert supabase_admin DEFAULT PRIVILEGES residual",
    );
  }

  if (evidencePath && fs.existsSync(evidencePath)) {
    try {
      const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
      const defs = evidence.default_privileges_supabase_admin_public;
      if (defs && defs.tables_grants_anon) {
        warnings.push(
          "LATENT: supabase_admin DEFAULT PRIVILEGES still grant table rights to anon on future public objects (support ticket required; do not SET ROLE)",
        );
      }
    } catch {
      /* already handled in layer 2 */
    }
  } else {
    warnings.push(
      "LATENT (expected until support fix): supabase_admin may still default-grant anon on future public tables/sequences/functions",
    );
  }

  console.log(
    "Operator cannot revoke supabase_admin defaults; migrations must REVOKE anon explicitly on new tables.",
  );
}

checkRepo();
checkRemoteEvidence();
checkLatentDefaultPrivileges();

if (warnings.length) {
  console.log("\nWARNINGS:");
  for (const w of warnings) console.log(" -", w);
}

if (failures.length) {
  console.error("\nSECURITY CHECK FAILED (Lot 0.7):");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("\nOK: Lot 0.7 future guards passed");
console.log(
  `Sensitive table watchlist (${SENSITIVE_TABLES.length}): ${SENSITIVE_TABLES.join(", ")}`,
);
