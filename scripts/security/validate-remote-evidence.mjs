#!/usr/bin/env node
/**
 * CAPTCF Lot 1 — validate redacted remote evidence JSON (no secrets).
 *
 * Usage:
 *   node scripts/security/validate-remote-evidence.mjs <path>
 *   node scripts/security/validate-remote-evidence.mjs --strict <path>
 *
 * Exit: 0 ok | 1 schema/security content fail | 2 environment error
 */
import fs from "node:fs";
import path from "node:path";

const EXIT_OK = 0;
const EXIT_FAIL = 1;
const EXIT_ENV = 2;

const REQUIRED_FIELDS = [
  "project_ref",
  "captured_at_utc",
  "anon_table_privilege_count",
  "anon_dangerous_privilege_tables",
  "anon_sensitive_access",
  "manifestly_permissive_policies",
  "sandbox_isolation_open_policies",
  "permissive_sandbox_is_null_policies",
  "account_function_stubs",
];

const ACCOUNT_FN_SLUGS = [
  "bootstrap-test-accounts",
  "create-formateur-account",
];

const SANDBOX_TABLES = [
  "groups",
  "group_members",
  "sessions",
  "devoirs",
  "resultats",
  "profils_eleves",
];

function usage() {
  console.error(
    "Usage: node scripts/security/validate-remote-evidence.mjs [--strict] <evidence.json>",
  );
}

function isSecretLikeKey(key) {
  return /key|secret|password|token|service_role|apikey|authorization/i.test(
    key,
  );
}

/**
 * @param {unknown} evidence
 * @param {{ strict?: boolean }} opts
 * @returns {{ ok: boolean, failures: string[], warnings: string[], summary: object }}
 */
export function validateEvidenceObject(evidence, opts = {}) {
  const failures = [];
  const warnings = [];
  const strict = Boolean(opts.strict);

  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return {
      ok: false,
      failures: ["evidence root must be a JSON object"],
      warnings: [],
      summary: {},
    };
  }

  const obj = /** @type {Record<string, unknown>} */ (evidence);

  for (const key of Object.keys(obj)) {
    if (key.startsWith("_")) continue;
    if (isSecretLikeKey(key)) {
      failures.push(`secret-like field name forbidden: ${key}`);
    }
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      const msg = `missing required field: ${field}`;
      if (strict) failures.push(msg);
      else warnings.push(msg);
    }
  }

  if ("anon_table_privilege_count" in obj) {
    if (typeof obj.anon_table_privilege_count !== "number") {
      failures.push("anon_table_privilege_count must be a number");
    }
  }

  for (const arrField of [
    "anon_dangerous_privilege_tables",
    "anon_sensitive_access",
    "manifestly_permissive_policies",
    "sandbox_isolation_open_policies",
    "permissive_sandbox_is_null_policies",
  ]) {
    if (arrField in obj && !Array.isArray(obj[arrField])) {
      failures.push(`${arrField} must be an array`);
    }
  }

  const stubs = obj.account_function_stubs;
  if (stubs !== undefined) {
    if (!stubs || typeof stubs !== "object" || Array.isArray(stubs)) {
      failures.push("account_function_stubs must be an object");
    } else {
      for (const slug of ACCOUNT_FN_SLUGS) {
        const st = /** @type {Record<string, unknown>} */ (stubs)[slug];
        if (!st) {
          const msg = `account_function_stubs.${slug} missing`;
          if (strict) failures.push(msg);
          else warnings.push(msg);
          continue;
        }
        if (typeof st !== "object" || Array.isArray(st)) {
          failures.push(`account_function_stubs.${slug} must be an object`);
          continue;
        }
        if (!("verify_jwt" in /** @type {object} */ (st))) {
          const msg = `account_function_stubs.${slug}.verify_jwt missing`;
          if (strict) failures.push(msg);
          else warnings.push(msg);
        }
      }
    }
  }

  const sandbox = Array.isArray(obj.sandbox_isolation_open_policies)
    ? obj.sandbox_isolation_open_policies
    : [];
  const sandboxCount = sandbox.length;

  const summary = {
    anon_table_privilege_count:
      typeof obj.anon_table_privilege_count === "number"
        ? obj.anon_table_privilege_count
        : null,
    sandbox_isolation_open_count: sandboxCount,
    sandbox_tables_hint: SANDBOX_TABLES,
    stubs_present: Boolean(stubs),
  };

  return {
    ok: failures.length === 0,
    failures,
    warnings,
    summary,
  };
}

/**
 * @param {string} evidencePath
 * @param {{ strict?: boolean }} opts
 */
export function validateEvidenceFile(evidencePath, opts = {}) {
  const resolved = path.resolve(evidencePath);
  if (!fs.existsSync(resolved)) {
    return {
      ok: false,
      envError: true,
      failures: [`evidence file not found: ${resolved}`],
      warnings: [],
      summary: {},
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch {
    return {
      ok: false,
      envError: false,
      failures: [`evidence file is not valid JSON: ${resolved}`],
      warnings: [],
      summary: {},
    };
  }

  const result = validateEvidenceObject(parsed, opts);
  return { ...result, envError: false, path: resolved };
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const positional = args.filter((a) => a !== "--strict");
  const file = positional[0];
  if (!file) {
    usage();
    process.exit(EXIT_ENV);
  }

  const result = validateEvidenceFile(file, { strict });
  if (result.warnings?.length) {
    console.log("WARNINGS:");
    for (const w of result.warnings) console.log(" -", w);
  }
  if (result.envError) {
    console.error("ENV ERROR:");
    for (const f of result.failures) console.error(" -", f);
    process.exit(EXIT_ENV);
  }
  if (!result.ok) {
    console.error("EVIDENCE VALIDATION FAILED:");
    for (const f of result.failures) console.error(" -", f);
    process.exit(EXIT_FAIL);
  }
  console.log("OK: remote evidence schema valid");
  console.log(JSON.stringify(result.summary, null, 2));
  process.exit(EXIT_OK);
}

const isDirect =
  process.argv[1] &&
  path.normalize(process.argv[1]).endsWith(
    path.normalize("validate-remote-evidence.mjs"),
  );

if (isDirect) {
  main();
}
