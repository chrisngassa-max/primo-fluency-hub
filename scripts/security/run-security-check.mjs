#!/usr/bin/env node
/**
 * CAPTCF Lot 1 — reproducible local security harness (no secrets, no remote mutation).
 *
 * Distinguishes:
 *   A) pure local repo checks (always runnable)
 *   B) remote redacted evidence JSON (optional --evidence)
 *   C) transactional SQL tests (optional --sql-results import; never auto-connects)
 *   D) blocking vs warning vs not_tested
 *
 * Exit codes (stable):
 *   0 = success (no blocking failures; warnings allowed)
 *   1 = blocking security failure
 *   2 = environment / harness error (missing node script, EPERM spawn, bad args, missing file)
 *
 * Usage (Windows PowerShell / bash):
 *   npm run security:check
 *   npm run security:check -- --evidence .local-security-evidence/remote.json
 *   npm run security:check -- --sql-results .local-security-evidence/sql-results.json
 *   node scripts/security/run-security-check.mjs --help
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEvidenceFile } from "./validate-remote-evidence.mjs";

const EXIT_OK = 0;
const EXIT_FAIL = 1;
const EXIT_ENV = 2;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const securityDir = path.join(root, "scripts", "security");

/** @typedef {'pass'|'fail'|'warn'|'not_tested'|'env_error'} CheckStatus */

/**
 * @typedef {object} CheckResult
 * @property {string} id
 * @property {string} layer  // local | evidence | sql
 * @property {CheckStatus} status
 * @property {'blocking'|'warning'|'info'} severity
 * @property {string} detail
 * @property {number|null} [exitCode]
 */

function printHelp() {
  console.log(`CAPTCF Lot 1 security harness

Usage:
  node scripts/security/run-security-check.mjs [options]

Options:
  --evidence <path>       Redacted remote evidence JSON (gitignored path recommended)
  --sql-results <path>    Imported SQL transactional test results JSON
  --strict-evidence       Treat missing evidence fields as blocking
  --json-report <path>    Write machine-readable report JSON
  --skip-local            Skip local assert scripts (evidence/sql only)
  --help                  Show this help

Exit codes:
  0 success | 1 blocking fail | 2 environment error

Local controls require no secrets. SQL is never executed by this harness.
`);
}

/**
 * Spawn a node script. Distinguishes EPERM / missing file as env errors.
 * @param {string} scriptRel
 * @param {string[]} args
 * @returns {{ status: CheckStatus, exitCode: number|null, detail: string, stdout: string, stderr: string }}
 */
function runNodeScript(scriptRel, args = []) {
  const scriptAbs = path.join(root, scriptRel);
  if (!fs.existsSync(scriptAbs)) {
    return {
      status: "env_error",
      exitCode: null,
      detail: `script missing: ${scriptRel}`,
      stdout: "",
      stderr: "",
    };
  }

  const result = spawnSync(process.execPath, [scriptAbs, ...args], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    windowsHide: true,
  });

  if (result.error) {
    const code = /** @type {NodeJS.ErrnoException} */ (result.error).code;
    if (code === "EPERM" || code === "EACCES") {
      return {
        status: "env_error",
        exitCode: null,
        detail:
          `spawn ${code} running ${scriptRel}. ` +
          `Workaround: run the script directly in an elevated/normal PowerShell outside the sandbox, e.g. ` +
          `node ${scriptRel}${args.length ? " " + args.join(" ") : ""}. ` +
          `Also try: Set-ExecutionPolicy -Scope Process RemoteSigned; ensure antivirus is not blocking node child processes.`,
        stdout: result.stdout || "",
        stderr: result.stderr || String(result.error),
      };
    }
    return {
      status: "env_error",
      exitCode: null,
      detail: `spawn failed for ${scriptRel}: ${result.error.message}`,
      stdout: result.stdout || "",
      stderr: result.stderr || String(result.error),
    };
  }

  const exitCode = result.status;
  if (exitCode === 0) {
    return {
      status: "pass",
      exitCode,
      detail: "ok",
      stdout: result.stdout || "",
      stderr: result.stderr || "",
    };
  }
  if (exitCode === 2) {
    return {
      status: "env_error",
      exitCode,
      detail: (result.stderr || result.stdout || "environment error").trim(),
      stdout: result.stdout || "",
      stderr: result.stderr || "",
    };
  }
  return {
    status: "fail",
    exitCode,
    detail: (result.stderr || result.stdout || `exit ${exitCode}`).trim(),
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

/**
 * @param {string} sqlResultsPath
 * @returns {{ results: CheckResult[], envError?: string }}
 */
function importSqlResults(sqlResultsPath) {
  /** @type {CheckResult[]} */
  const results = [];
  const resolved = path.resolve(sqlResultsPath);
  if (!fs.existsSync(resolved)) {
    return {
      results: [],
      envError: `sql-results file not found: ${resolved}`,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch {
    return { results: [], envError: `sql-results is not valid JSON: ${resolved}` };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { results: [], envError: "sql-results root must be an object" };
  }

  for (const key of Object.keys(parsed)) {
    if (key.startsWith("_")) continue;
    if (/key|secret|password|token|service_role/i.test(key)) {
      return {
        results: [],
        envError: `sql-results must not contain secret-like field: ${key}`,
      };
    }
  }

  const tests = parsed.tests;
  if (!tests || typeof tests !== "object") {
    return {
      results: [],
      envError: "sql-results.tests object required (see sql-results.example.json)",
    };
  }

  const expected = [
    "lot05_placement_rls_refusal",
    "lot06_anon_privileges_refusal",
    "lot07_future_guards",
    "lot08_sandbox_isolation",
  ];

  for (const id of expected) {
    const entry = tests[id];
    if (!entry) {
      results.push({
        id: `sql:${id}`,
        layer: "sql",
        status: "not_tested",
        severity: "info",
        detail: "absent from imported results",
      });
      continue;
    }
    const statusRaw = String(entry.status || "").toLowerCase();
    /** @type {CheckStatus} */
    let status = "not_tested";
    if (statusRaw === "pass" || statusRaw === "ok") status = "pass";
    else if (statusRaw === "fail" || statusRaw === "failed") status = "fail";
    else if (statusRaw === "warn" || statusRaw === "warning") status = "warn";
    else if (statusRaw === "not_run" || statusRaw === "not_tested" || statusRaw === "skip")
      status = "not_tested";
    else {
      results.push({
        id: `sql:${id}`,
        layer: "sql",
        status: "env_error",
        severity: "blocking",
        detail: `unknown status "${entry.status}"`,
      });
      continue;
    }

    results.push({
      id: `sql:${id}`,
      layer: "sql",
      status,
      severity: status === "fail" ? "blocking" : status === "warn" ? "warning" : "info",
      detail: entry.notes ? String(entry.notes) : status,
    });
  }

  return { results };
}

function parseArgs(argv) {
  const out = {
    evidence: null,
    sqlResults: null,
    strictEvidence: false,
    jsonReport: null,
    skipLocal: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--strict-evidence") out.strictEvidence = true;
    else if (a === "--skip-local") out.skipLocal = true;
    else if (a === "--evidence") out.evidence = argv[++i] || null;
    else if (a === "--sql-results") out.sqlResults = argv[++i] || null;
    else if (a === "--json-report") out.jsonReport = argv[++i] || null;
    else {
      console.error(`Unknown argument: ${a}`);
      out.help = true;
      out._unknown = true;
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(args._unknown ? EXIT_ENV : EXIT_OK);
  }

  /** @type {CheckResult[]} */
  const checks = [];
  let envFatal = null;

  console.log("CAPTCF Lot 1 — security:check");
  console.log(`cwd: ${root}`);
  console.log(`node: ${process.version}`);
  console.log("");

  // ---- A) Local asserts ----
  if (!args.skipLocal) {
    console.log("== A) Local repo controls ==");
    const localScripts = [
      {
        id: "local:assert-lot07-future-guards",
        rel: "scripts/security/assert-lot07-future-guards.mjs",
      },
      {
        id: "local:assert-no-insecure-account-bootstraps",
        rel: "scripts/security/assert-no-insecure-account-bootstraps.mjs",
      },
      {
        id: "local:assert-no-prod-bootstrap",
        rel: "scripts/security/assert-no-prod-bootstrap.mjs",
      },
    ];

    for (const s of localScripts) {
      const r = runNodeScript(s.rel);
      const truncated = r.detail.length > 500 ? r.detail.slice(0, 500) + "…" : r.detail;
      checks.push({
        id: s.id,
        layer: "local",
        status: r.status,
        severity: r.status === "fail" || r.status === "env_error" ? "blocking" : "info",
        detail: truncated,
        exitCode: r.exitCode,
      });
      const mark =
        r.status === "pass"
          ? "PASS"
          : r.status === "env_error"
            ? "ENV_ERROR"
            : "FAIL";
      console.log(`  [${mark}] ${s.id}`);
      if (r.status !== "pass") {
        console.log(`         ${truncated.replace(/\n/g, "\n         ")}`);
      }
      if (r.status === "env_error" && !envFatal) {
        envFatal = truncated;
      }
    }
  } else {
    console.log("== A) Local repo controls == SKIPPED (--skip-local)");
  }

  // ---- B) Evidence ----
  console.log("\n== B) Remote redacted evidence ==");
  if (!args.evidence) {
    checks.push({
      id: "evidence:schema",
      layer: "evidence",
      status: "not_tested",
      severity: "info",
      detail: "no --evidence path provided",
    });
    checks.push({
      id: "evidence:lot07-remote-assertions",
      layer: "evidence",
      status: "not_tested",
      severity: "info",
      detail: "no --evidence path provided",
    });
    console.log("  [NOT_TESTED] pass --evidence <json> for remote assertions");
  } else {
    const schema = validateEvidenceFile(args.evidence, {
      strict: args.strictEvidence,
    });
    if (schema.envError) {
      checks.push({
        id: "evidence:schema",
        layer: "evidence",
        status: "env_error",
        severity: "blocking",
        detail: schema.failures.join("; "),
      });
      console.log("  [ENV_ERROR] evidence schema");
      console.log(`         ${schema.failures.join("; ")}`);
      envFatal = schema.failures.join("; ");
    } else if (!schema.ok) {
      checks.push({
        id: "evidence:schema",
        layer: "evidence",
        status: "fail",
        severity: "blocking",
        detail: schema.failures.join("; "),
      });
      console.log("  [FAIL] evidence schema");
      for (const f of schema.failures) console.log(`         - ${f}`);
    } else {
      checks.push({
        id: "evidence:schema",
        layer: "evidence",
        status: schema.warnings.length ? "warn" : "pass",
        severity: schema.warnings.length ? "warning" : "info",
        detail: schema.warnings.length
          ? schema.warnings.join("; ")
          : `ok sandbox_open=${schema.summary.sandbox_isolation_open_count}`,
      });
      console.log(
        `  [${schema.warnings.length ? "WARN" : "PASS"}] evidence schema (sandbox_open=${schema.summary.sandbox_isolation_open_count})`,
      );
      for (const w of schema.warnings) console.log(`         warn: ${w}`);

      // Run lot07 with evidence (includes sandbox residual fail-closed, anon grants, stubs)
      const r = runNodeScript("scripts/security/assert-lot07-future-guards.mjs", [
        "--evidence",
        path.resolve(args.evidence),
      ]);
      const truncated =
        r.detail.length > 800 ? r.detail.slice(0, 800) + "…" : r.detail;
      checks.push({
        id: "evidence:lot07-remote-assertions",
        layer: "evidence",
        status: r.status,
        severity:
          r.status === "fail" || r.status === "env_error" ? "blocking" : "info",
        detail: truncated,
        exitCode: r.exitCode,
      });
      const mark =
        r.status === "pass"
          ? "PASS"
          : r.status === "env_error"
            ? "ENV_ERROR"
            : "FAIL";
      console.log(`  [${mark}] evidence:lot07-remote-assertions`);
      if (r.status !== "pass") {
        console.log(`         ${truncated.replace(/\n/g, "\n         ")}`);
      }
      if (r.status === "env_error" && !envFatal) envFatal = truncated;
    }
  }

  // ---- C) SQL results import ----
  console.log("\n== C) SQL transactional results (import only) ==");
  if (!args.sqlResults) {
    for (const id of [
      "lot05_placement_rls_refusal",
      "lot06_anon_privileges_refusal",
      "lot07_future_guards",
      "lot08_sandbox_isolation",
    ]) {
      checks.push({
        id: `sql:${id}`,
        layer: "sql",
        status: "not_tested",
        severity: "info",
        detail:
          "SQL not auto-run (no remote credentials). Import via --sql-results after BEGIN…ROLLBACK in SQL editor/MCP.",
      });
    }
    console.log("  [NOT_TESTED] provide --sql-results <json> after manual ROLLBACK tests");
    console.log(
      "  SQL files: supabase/tests/lot05_placement_rls_refusal.sql, lot06_*, lot07_*, lot08_*",
    );
  } else {
    const imported = importSqlResults(args.sqlResults);
    if (imported.envError) {
      checks.push({
        id: "sql:import",
        layer: "sql",
        status: "env_error",
        severity: "blocking",
        detail: imported.envError,
      });
      console.log("  [ENV_ERROR] sql import");
      console.log(`         ${imported.envError}`);
      envFatal = imported.envError;
    } else {
      for (const c of imported.results) {
        checks.push(c);
        const mark =
          c.status === "pass"
            ? "PASS"
            : c.status === "fail"
              ? "FAIL"
              : c.status === "warn"
                ? "WARN"
                : c.status === "env_error"
                  ? "ENV_ERROR"
                  : "NOT_TESTED";
        console.log(`  [${mark}] ${c.id}${c.detail && c.detail !== c.status ? " — " + c.detail : ""}`);
      }
    }
  }

  // ---- Summary ----
  const blockingFails = checks.filter(
    (c) => c.status === "fail" && c.severity === "blocking",
  );
  const envErrors = checks.filter((c) => c.status === "env_error");
  const warnings = checks.filter(
    (c) => c.status === "warn" || c.severity === "warning",
  );
  const notTested = checks.filter((c) => c.status === "not_tested");
  const passes = checks.filter((c) => c.status === "pass");

  console.log("\n== Summary ==");
  console.log(`  pass=${passes.length} fail=${blockingFails.length} warn=${warnings.length} not_tested=${notTested.length} env_error=${envErrors.length}`);

  for (const c of blockingFails) {
    console.log(`  BLOCKING: ${c.id}`);
  }
  for (const c of envErrors) {
    console.log(`  ENV: ${c.id}`);
  }

  const report = {
    harness: "captcf-lot-01",
    generated_at_utc: new Date().toISOString(),
    exit_code_meanings: {
      "0": "success",
      "1": "blocking_security_failure",
      "2": "environment_error",
    },
    args: {
      evidence: args.evidence,
      sqlResults: args.sqlResults,
      strictEvidence: args.strictEvidence,
      skipLocal: args.skipLocal,
    },
    checks,
    counts: {
      pass: passes.length,
      fail: blockingFails.length,
      warn: warnings.length,
      not_tested: notTested.length,
      env_error: envErrors.length,
    },
  };

  if (args.jsonReport) {
    const outPath = path.resolve(args.jsonReport);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nWrote report: ${outPath}`);
  }

  if (envErrors.length || envFatal) {
    console.error("\nRESULT: ENVIRONMENT ERROR (exit 2) — not a security pass");
    process.exit(EXIT_ENV);
  }
  if (blockingFails.length) {
    console.error("\nRESULT: BLOCKING SECURITY FAILURE (exit 1)");
    process.exit(EXIT_FAIL);
  }
  console.log("\nRESULT: SUCCESS (exit 0) — local/evidence/sql blocking checks passed");
  if (notTested.length) {
    console.log(`Note: ${notTested.length} control(s) not_tested (evidence/SQL optional layers).`);
  }
  process.exit(EXIT_OK);
}

main();
