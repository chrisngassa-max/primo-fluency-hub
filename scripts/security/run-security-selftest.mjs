#!/usr/bin/env node
/**
 * CAPTCF Lot 1 / 0.8B — harness self-test against fixtures (no secrets, no PII).
 *
 * A negative fixture that correctly fails is a SUCCESS for that scenario.
 * Environment errors are never counted as test success.
 *
 * Usage:
 *   npm run security:selftest
 *   node scripts/security/run-security-selftest.mjs
 *
 * Exit: 0 all scenarios matched | 1 scenario mismatch | 2 environment error
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXIT_OK = 0;
const EXIT_FAIL = 1;
const EXIT_ENV = 2;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const harness = path.join(__dirname, "run-security-check.mjs");
const fixturesDir = path.join(__dirname, "fixtures");

/**
 * @param {string[]} args
 * @returns {{ kind: 'ok'|'fail'|'env', code: number|null, detail: string }}
 */
function runHarness(args) {
  const result = spawnSync(process.execPath, [harness, ...args], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    windowsHide: true,
  });

  if (result.error) {
    const code = /** @type {NodeJS.ErrnoException} */ (result.error).code;
    return {
      kind: "env",
      code: null,
      detail:
        code === "EPERM" || code === "EACCES"
          ? `spawn ${code}: run selftest outside sandbox — node scripts/security/run-security-selftest.mjs`
          : result.error.message,
    };
  }

  const code = result.status;
  const detail = ((result.stderr || "") + "\n" + (result.stdout || "")).trim();
  if (code === 2) return { kind: "env", code, detail };
  if (code === 1) return { kind: "fail", code, detail };
  if (code === 0) return { kind: "ok", code, detail };
  return { kind: "env", code, detail: `unexpected exit ${code}\n${detail}` };
}

/**
 * @param {string} name
 * @param {'ok'|'fail'} expected
 * @param {string[]} args
 * @param {{ mustContain?: string[] }} [opts]
 */
function expectScenario(name, expected, args, opts = {}) {
  const r = runHarness(args);
  if (r.kind === "env") {
    return {
      name,
      matched: false,
      envError: true,
      detail: r.detail.slice(0, 600),
    };
  }
  const got = r.kind;
  let matched = got === expected;
  const missing = [];
  if (matched && opts.mustContain) {
    for (const needle of opts.mustContain) {
      if (!r.detail.includes(needle)) {
        matched = false;
        missing.push(needle);
      }
    }
  }
  return {
    name,
    matched,
    envError: false,
    expected,
    got,
    missing,
    detail: matched ? "ok" : r.detail.slice(0, 600),
  };
}

function testBadMigrationDetection() {
  const migDir = path.join(root, "supabase", "migrations");
  const tmpName = "20991231999999_lot01_fixture_bad_table.sql";
  const tmpPath = path.join(migDir, tmpName);
  const src = path.join(fixturesDir, "bad-migration-create-table.sql");

  let wrote = false;
  try {
    fs.copyFileSync(src, tmpPath);
    wrote = true;
    const r2 = runHarness([]);
    if (r2.kind === "env") {
      return {
        name: "local:bad-migration-create-table",
        matched: false,
        envError: true,
        detail: r2.detail.slice(0, 600),
      };
    }
    const matched =
      r2.kind === "fail" &&
      (r2.detail.includes("REVOKE") ||
        r2.detail.includes("GRANT") ||
        r2.detail.includes(tmpName) ||
        r2.detail.includes("lot01_fixture"));
    return {
      name: "local:bad-migration-create-table",
      matched,
      envError: false,
      expected: "fail",
      got: r2.kind,
      detail: matched ? "ok" : r2.detail.slice(0, 600),
    };
  } finally {
    if (wrote && fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
}

function main() {
  console.log("CAPTCF Lot 1 / 0.8B — security selftest\n");

  if (!fs.existsSync(harness)) {
    console.error("ENV: harness missing");
    process.exit(EXIT_ENV);
  }

  /** @type {Array<ReturnType<typeof expectScenario>>} */
  const results = [];

  results.push(
    expectScenario("local:repo-controls", "ok", [], {
      mustContain: ["RESULT: SUCCESS"],
    }),
  );

  results.push(
    expectScenario(
      "evidence:valid (6 RESTRICTIVE)",
      "ok",
      [
        "--skip-local",
        "--evidence",
        path.join(fixturesDir, "evidence-valid.json"),
      ],
      { mustContain: ["RESULT: SUCCESS"] },
    ),
  );

  results.push(
    expectScenario(
      "evidence:sandbox-permissive",
      "fail",
      [
        "--skip-local",
        "--evidence",
        path.join(fixturesDir, "evidence-sandbox-permissive.json"),
      ],
      {
        mustContain: ["PERMISSIVE"],
      },
    ),
  );

  results.push(
    expectScenario(
      "evidence:sandbox-missing",
      "fail",
      [
        "--skip-local",
        "--evidence",
        path.join(fixturesDir, "evidence-sandbox-missing.json"),
      ],
      {
        mustContain: ["missing"],
      },
    ),
  );

  results.push(
    expectScenario(
      "evidence:sandbox-altered-expr",
      "fail",
      [
        "--skip-local",
        "--evidence",
        path.join(fixturesDir, "evidence-sandbox-altered-expr.json"),
      ],
      {
        mustContain: ["altered"],
      },
    ),
  );

  results.push(
    expectScenario(
      "evidence:sandbox-open-obsolete-field",
      "fail",
      [
        "--skip-local",
        "--evidence",
        path.join(fixturesDir, "evidence-sandbox-open.json"),
      ],
      {
        mustContain: ["obsolete"],
      },
    ),
  );

  results.push(
    expectScenario(
      "evidence:anon-grants",
      "fail",
      [
        "--skip-local",
        "--evidence",
        path.join(fixturesDir, "evidence-anon-grants.json"),
      ],
      { mustContain: ["anon"] },
    ),
  );

  results.push(
    expectScenario(
      "evidence:stub-unprotected",
      "fail",
      [
        "--skip-local",
        "--evidence",
        path.join(fixturesDir, "evidence-stub-unprotected.json"),
      ],
      { mustContain: ["verify_jwt"] },
    ),
  );

  results.push(
    expectScenario(
      "evidence:incomplete (strict)",
      "fail",
      [
        "--skip-local",
        "--strict-evidence",
        "--evidence",
        path.join(fixturesDir, "evidence-incomplete.json"),
      ],
      { mustContain: ["missing required field"] },
    ),
  );

  results.push(testBadMigrationDetection());

  let envHit = false;
  let mismatch = false;
  console.log("Scenario results:");
  for (const r of results) {
    if (r.envError) {
      envHit = true;
      console.log(`  [ENV_ERROR] ${r.name}`);
      console.log(`             ${r.detail}`);
      continue;
    }
    if (r.matched) {
      console.log(
        `  [SCENARIO_OK] ${r.name} (expected ${r.expected || "fail"} → got ${r.got || "fail"})`,
      );
    } else {
      mismatch = true;
      console.log(`  [SCENARIO_MISMATCH] ${r.name}`);
      console.log(`             expected=${r.expected} got=${r.got}`);
      if (r.missing?.length) console.log(`             missing needles: ${r.missing.join(", ")}`);
      console.log(`             ${r.detail}`);
    }
  }

  const okCount = results.filter((r) => r.matched && !r.envError).length;
  console.log(`\nSelftest: ${okCount}/${results.length} scenarios matched`);

  if (envHit) {
    console.error("RESULT: ENVIRONMENT ERROR (exit 2) — scenarios not fully executed");
    process.exit(EXIT_ENV);
  }
  if (mismatch) {
    console.error("RESULT: SELFTEST FAILURE (exit 1)");
    process.exit(EXIT_FAIL);
  }
  console.log("RESULT: SELFTEST SUCCESS (exit 0)");
  process.exit(EXIT_OK);
}

main();
