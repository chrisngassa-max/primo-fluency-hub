#!/usr/bin/env node
/**
 * CAPTCF Lot 0.6 — fail if create-formateur-account could be redeployed insecurely.
 * Also re-checks bootstrap-test-accounts Lot 0.5 guards.
 * Usage: node scripts/security/assert-no-insecure-account-bootstraps.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function checkStubFunction(slug, label) {
  const fnPath = path.join(root, "supabase", "functions", slug, "index.ts");
  const fn = fs.readFileSync(fnPath, "utf8");
  if (/createUser\s*\(/.test(fn)) {
    failures.push(`${label} still contains createUser()`);
  }
  if (/password\s*:\s*["'`]/.test(fn) || /CapTcf2025/.test(fn)) {
    failures.push(`${label} appears to embed hardcoded passwords`);
  }
  if (!/\b410\b/.test(fn)) {
    failures.push(`${label} should return HTTP 410 when disabled`);
  }
  return fn;
}

function checkConfigVerifyJwtTrue(slug) {
  const cfgPath = path.join(root, "supabase", "config.toml");
  const cfg = fs.readFileSync(cfgPath, "utf8");
  const re = new RegExp(
    `\\[functions\\.${slug.replace(/[-]/g, "\\-")}\\]\\s*\\n([^\\[]*)`,
  );
  const block = cfg.match(re);
  if (!block) {
    failures.push(`config.toml missing [functions.${slug}]`);
    return;
  }
  const assignments = block[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const jwtLine = assignments.find((l) => l.startsWith("verify_jwt"));
  if (!jwtLine) {
    failures.push(`${slug} verify_jwt must be true`);
  } else if (/verify_jwt\s*=\s*false/.test(jwtLine)) {
    failures.push(`${slug} verify_jwt must not be false`);
  } else if (!/verify_jwt\s*=\s*true/.test(jwtLine)) {
    failures.push(`${slug} verify_jwt must be true`);
  }
}

checkStubFunction("bootstrap-test-accounts", "bootstrap-test-accounts");
checkStubFunction("create-formateur-account", "create-formateur-account");
checkConfigVerifyJwtTrue("bootstrap-test-accounts");
checkConfigVerifyJwtTrue("create-formateur-account");

// Migration must revoke TRUNCATE/DELETE from anon globally
const migDir = path.join(root, "supabase", "migrations");
const migFiles = fs
  .readdirSync(migDir)
  .filter((f) => f.includes("lot06_confine_global_anon"));
if (!migFiles.length) {
  failures.push("missing lot06_confine_global_anon migration file");
} else {
  const mig = fs.readFileSync(path.join(migDir, migFiles[0]), "utf8");
  if (!/REVOKE ALL ON TABLE public\.%I FROM anon/.test(mig)) {
    failures.push("lot06 migration must REVOKE ALL from anon on public tables");
  }
  if (!/pedagogical_images_insert_all/.test(mig)) {
    failures.push("lot06 migration must drop pedagogical_images_insert_all");
  }
}

if (failures.length) {
  console.error("SECURITY CHECK FAILED (Lot 0.6):");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("OK: Lot 0.6 account-bootstrap + anon confinement checks passed");
