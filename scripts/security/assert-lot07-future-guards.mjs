#!/usr/bin/env node
/**
 * CAPTCF Lot 0.7 / 0.8B — future-proof security guards (local, no secrets).
 *
 * Distinguishes three layers:
 *   1) repo / migrations state
 *   2) optional observed remote evidence JSON (never prints keys)
 *   3) latent DEFAULT PRIVILEGES risk (system role)
 *
 * Lot 0.8B correction:
 *   - Six RESTRICTIVE "Sandbox isolation" policies are EXPECTED and must be preserved.
 *   - A PERMISSIVE policy with (sandbox_session_id IS NULL OR can_access_sandbox(...))
 *     is BLOCKING (true exposure).
 *   - Missing / converted-to-PERMISSIVE / altered expression → fail.
 *   - Lot 0.8 Phase B DROP migration is ABANDONED and must not live under migrations/.
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

/** Exact inventory expected for Sandbox isolation (Lot 0.8B). */
export const EXPECTED_SANDBOX_ISOLATION = [
  { table: "groups", policy: "Sandbox isolation", cmd: "SELECT", permissive: "RESTRICTIVE" },
  { table: "group_members", policy: "Sandbox isolation", cmd: "SELECT", permissive: "RESTRICTIVE" },
  { table: "sessions", policy: "Sandbox isolation", cmd: "SELECT", permissive: "RESTRICTIVE" },
  { table: "devoirs", policy: "Sandbox isolation", cmd: "SELECT", permissive: "RESTRICTIVE" },
  { table: "resultats", policy: "Sandbox isolation", cmd: "SELECT", permissive: "RESTRICTIVE" },
  { table: "profils_eleves", policy: "Sandbox isolation", cmd: "SELECT", permissive: "RESTRICTIVE" },
];

/**
 * Canonical RESTRICTIVE USING expression (parentheses / public. schema optional).
 * Widened or altered expressions fail.
 */
export const SANDBOX_ISOLATION_QUAL_RE =
  /^\(?\s*sandbox_session_id\s+IS\s+NULL\s*\)?\s+OR\s+(?:public\.)?can_access_sandbox\s*\(\s*sandbox_session_id\s*\)\s*$/i;

const ABANDONED_LOT08_MIGRATION = "20260917223000_lot08_confine_sandbox_isolation.sql";

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

function normalizeQual(qual) {
  return String(qual || "")
    .replace(/\s+/g, " ")
    .replace(/^\(+/, "(")
    .replace(/\)+$/, ")")
    .trim();
}

/**
 * Validate typed sandbox isolation inventory from evidence.
 * @param {unknown[]} inventory
 * @returns {string[]} failure messages
 */
export function assertSandboxIsolationInventory(inventory) {
  const msgs = [];
  if (!Array.isArray(inventory)) {
    return ["remote: sandbox_isolation_policies must be an array (typed inventory)"];
  }

  const byTable = new Map();
  for (const raw of inventory) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      msgs.push("remote: sandbox_isolation_policies entries must be objects");
      continue;
    }
    const p = /** @type {Record<string, unknown>} */ (raw);
    const table = String(p.table || "");
    if (!table) {
      msgs.push("remote: sandbox_isolation_policies entry missing table");
      continue;
    }
    if (byTable.has(table)) {
      msgs.push(`remote: duplicate sandbox_isolation_policies entry for table ${table}`);
    }
    byTable.set(table, p);
  }

  for (const expected of EXPECTED_SANDBOX_ISOLATION) {
    const got = byTable.get(expected.table);
    if (!got) {
      msgs.push(
        `remote: missing expected RESTRICTIVE Sandbox isolation on ${expected.table}`,
      );
      continue;
    }

    const policy = String(got.policy || got.policyname || "");
    const cmd = String(got.cmd || "").toUpperCase();
    const permissive = String(got.permissive || "").toUpperCase();
    const qual = normalizeQual(got.qual || got.using || got.expression || "");

    if (policy !== expected.policy) {
      msgs.push(
        `remote: ${expected.table}: policy name "${policy}" !== "${expected.policy}"`,
      );
    }
    if (cmd !== expected.cmd) {
      msgs.push(
        `remote: ${expected.table}: cmd "${cmd}" !== "${expected.cmd}"`,
      );
    }
    if (permissive === "PERMISSIVE") {
      msgs.push(
        `remote: ${expected.table}: Sandbox isolation converted to PERMISSIVE (blocking exposure)`,
      );
    } else if (permissive !== expected.permissive) {
      msgs.push(
        `remote: ${expected.table}: permissive="${permissive}" !== RESTRICTIVE`,
      );
    }

    // Accept optional parens around IS NULL and optional public. schema prefix
    if (!SANDBOX_ISOLATION_QUAL_RE.test(qual)) {
      msgs.push(
        `remote: ${expected.table}: Sandbox isolation expression altered/widened (got: ${qual.slice(0, 120)})`,
      );
    }

    byTable.delete(expected.table);
  }

  for (const extra of byTable.keys()) {
    msgs.push(
      `remote: unexpected sandbox_isolation_policies table ${extra} (not in expected six)`,
    );
  }

  return msgs;
}

/**
 * Detect true danger: PERMISSIVE policies opening IS NULL OR can_access_sandbox.
 * @param {unknown[]} list
 */
export function assertNoPermissiveSandboxOpen(list) {
  const msgs = [];
  if (!Array.isArray(list)) {
    if (list !== undefined) {
      msgs.push("remote: permissive_sandbox_is_null_policies must be an array");
    }
    return msgs;
  }
  if (list.length) {
    msgs.push(
      `remote: PERMISSIVE policies open sandbox_session_id IS NULL OR can_access_sandbox (${list.length})`,
    );
  }
  return msgs;
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

  // Lot 0.8B: abandoned Phase B DROP must not be appliable via migrations/
  if (migFiles.includes(ABANDONED_LOT08_MIGRATION)) {
    failures.push(
      `abandoned Lot 0.8 Phase B migration must be removed from migrations/: ${ABANDONED_LOT08_MIGRATION}`,
    );
  }
  const lot08Drop = migFiles.find(
    (f) =>
      f.includes("lot08_confine_sandbox") ||
      (f.includes("lot08") && /sandbox/i.test(f)),
  );
  if (lot08Drop) {
    failures.push(
      `Lot 0.8 Phase B DROP migration must not exist under migrations/ (found ${lot08Drop}); policies RESTRICTIVE must be kept`,
    );
  }

  if (lot06) {
    const mig = readUtf8(path.join("supabase", "migrations", lot06));
    if (!/REVOKE ALL ON TABLE public\.%I FROM anon/.test(mig)) {
      failures.push("lot06 migration must REVOKE ALL from anon on public tables");
    }
  }

  // Historical origin of the six RESTRICTIVE policies must still declare AS RESTRICTIVE
  const sandboxV4 = migFiles.find((f) => f.includes("sandbox_v4"));
  if (!sandboxV4) {
    failures.push("missing historical sandbox_v4 migration defining Sandbox isolation");
  } else {
    const mig = readUtf8(path.join("supabase", "migrations", sandboxV4));
    const restrictiveCreates = (
      mig.match(
        /CREATE\s+POLICY\s+"Sandbox isolation"[\s\S]{0,80}?AS\s+RESTRICTIVE/gi,
      ) || []
    ).length;
    if (restrictiveCreates < 6) {
      failures.push(
        "sandbox_v4 must CREATE 6 Sandbox isolation policies AS RESTRICTIVE",
      );
    }
    if (
      /CREATE\s+POLICY\s+"Sandbox isolation"[\s\S]{0,120}?AS\s+PERMISSIVE/i.test(
        mig,
      )
    ) {
      failures.push(
        "sandbox_v4 must not define Sandbox isolation as PERMISSIVE",
      );
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

    // Block accidental PERMISSIVE Sandbox open in new migrations
    if (
      /CREATE\s+POLICY\b[\s\S]{0,400}?sandbox_session_id\s+IS\s+NULL[\s\S]{0,200}?can_access_sandbox/i.test(
        sql,
      ) &&
      !/AS\s+RESTRICTIVE/i.test(sql)
    ) {
      failures.push(
        `${file}: PERMISSIVE (or non-RESTRICTIVE) policy with sandbox_session_id IS NULL OR can_access_sandbox is forbidden`,
      );
    }
  }

  console.log(
    `Checked account stubs, lot05/06, sandbox_v4 RESTRICTIVE, abandoned lot08 absent, ${postLot06.length} post-lot06 migration(s)`,
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

  // Lot 0.8B: typed inventory replaces obsolete sandbox_isolation_open_policies = []
  if ("sandbox_isolation_open_policies" in evidence) {
    failures.push(
      "remote: obsolete field sandbox_isolation_open_policies — use sandbox_isolation_policies typed inventory (Lot 0.8B)",
    );
  }

  if (!("sandbox_isolation_policies" in evidence)) {
    failures.push(
      "remote: missing sandbox_isolation_policies (typed inventory of 6 RESTRICTIVE Sandbox isolation policies)",
    );
  } else {
    for (const msg of assertSandboxIsolationInventory(
      evidence.sandbox_isolation_policies,
    )) {
      failures.push(msg);
    }
  }

  for (const msg of assertNoPermissiveSandboxOpen(
    evidence.permissive_sandbox_is_null_policies,
  )) {
    failures.push(msg);
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
  if (!/RESTRICTIVE/i.test(sql) || !/Sandbox isolation/i.test(sql)) {
    failures.push(
      "lot07 SQL test must assert RESTRICTIVE Sandbox isolation inventory (Lot 0.8B)",
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
  console.error("\nSECURITY CHECK FAILED (Lot 0.7/0.8B):");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("\nOK: Lot 0.7/0.8B future guards passed");
console.log(
  `Sensitive table watchlist (${SENSITIVE_TABLES.length}): ${SENSITIVE_TABLES.join(", ")}`,
);
console.log(
  `Sandbox isolation: expect ${EXPECTED_SANDBOX_ISOLATION.length} RESTRICTIVE policies preserved`,
);
