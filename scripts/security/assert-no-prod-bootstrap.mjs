#!/usr/bin/env node
/**
 * CAPTCF Lot 0.5 — fail if bootstrap-test-accounts could be redeployed insecurely.
 * Usage: node scripts/security/assert-no-prod-bootstrap.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const fnPath = path.join(
  root,
  "supabase",
  "functions",
  "bootstrap-test-accounts",
  "index.ts",
);
const cfgPath = path.join(root, "supabase", "config.toml");

const fn = fs.readFileSync(fnPath, "utf8");
const cfg = fs.readFileSync(cfgPath, "utf8");

if (/createUser\s*\(/.test(fn)) {
  failures.push("bootstrap-test-accounts still contains createUser()");
}
if (/password\s*:\s*["'`]/.test(fn)) {
  failures.push("bootstrap-test-accounts appears to embed hardcoded passwords");
}
if (!/status:\s*410/.test(fn) && !/status:\s*410/.test(fn.replace(/\s/g, ""))) {
  // also accept numeric 410 in Response
  if (!/\b410\b/.test(fn)) {
    failures.push("bootstrap-test-accounts should return HTTP 410 when disabled");
  }
}

const bootstrapCfg = cfg.match(
  /\[functions\.bootstrap-test-accounts\][\s\S]*?(?=\n\s*\[|$)/,
);
if (!bootstrapCfg) {
  failures.push("config.toml missing [functions.bootstrap-test-accounts]");
} else if (/verify_jwt\s*=\s*false/.test(bootstrapCfg[0])) {
  failures.push("bootstrap-test-accounts verify_jwt must not be false");
} else if (!/verify_jwt\s*=\s*true/.test(bootstrapCfg[0])) {
  failures.push("bootstrap-test-accounts verify_jwt must be true");
}

if (failures.length) {
  console.error("SECURITY CHECK FAILED (Lot 0.5 bootstrap):");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("OK: bootstrap-test-accounts confinement checks passed");
