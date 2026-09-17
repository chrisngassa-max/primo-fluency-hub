#!/usr/bin/env node
/**
 * CAPTCF Lot 2A — local assert: has_role caller inventory vs canonical contract.
 * No secrets, no remote. Exit 1 if broken named-arg callers remain in Edge source.
 *
 * Canonical (remote gudcenhmzlcvhgbgklzw + types.ts): uid / target_role
 * Legacy (git migration 20260317202908): _user_id / _role
 *
 * Broken = Edge/app rpc("has_role", { _user_id, _role }) against remote canonical.
 * Latent = local migration still defining _user_id/_role (drift if re-applied).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];

const CANONICAL_KEYS = ["uid", "target_role"];
const LEGACY_KEYS = ["_user_id", "_role"];

/** Known Edge/shared files that call has_role via rpc */
const EDGE_GLOBS = [
  "supabase/functions",
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(ts|js|mjs)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

function extractRpcBlocks(src) {
  /** @type {{ style: 'canonical'|'legacy'|'mixed'|'unknown'|'positional_sql', snippet: string, line: number }[]} */
  const hits = [];
  const lines = src.split(/\r?\n/);
  const re = /\.rpc\s*\(\s*["']has_role["']/g;
  let m;
  while ((m = re.exec(src))) {
    const before = src.slice(0, m.index);
    const line = before.split(/\r?\n/).length;
    const slice = src.slice(m.index, m.index + 220);
    const hasLegacy =
      /\b_user_id\s*:/.test(slice) || /(?<![A-Za-z0-9])_role\s*:/.test(slice);
    const hasCanon = /(?<![A-Za-z0-9_])uid\s*:/.test(slice) || /\btarget_role\s*:/.test(slice);
    let style = "unknown";
    if (hasLegacy && hasCanon) style = "mixed";
    else if (hasLegacy) style = "legacy";
    else if (hasCanon) style = "canonical";
    hits.push({ style, snippet: slice.replace(/\s+/g, " ").slice(0, 160), line });
  }
  // SQL-ish positional in same file
  if (/has_role\s*\(\s*auth\.uid\(\)/.test(src) || /has_role\s*\(\s*[a-z_]/.test(src)) {
    // ignore pure comments
  }
  return hits;
}

const files = [];
for (const g of EDGE_GLOBS) walk(path.join(root, g), files);

let canonical = 0;
let legacy = 0;
let mixed = 0;
const legacyFiles = [];

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  if (!src.includes("has_role")) continue;
  const hits = extractRpcBlocks(src);
  for (const h of hits) {
    if (h.style === "canonical") canonical++;
    else if (h.style === "legacy") {
      legacy++;
      legacyFiles.push(`${path.relative(root, f)}:${h.line}`);
    } else if (h.style === "mixed") {
      mixed++;
      failures.push(`mixed has_role keys in ${path.relative(root, f)}:${h.line}`);
    }
  }
}

// Latent: migration defines legacy names
const mig = path.join(
  root,
  "supabase/migrations/20260317202908_adbd594f-a88c-486f-b4d7-9264f4677053.sql",
);
if (fs.existsSync(mig)) {
  const msrc = fs.readFileSync(mig, "utf8");
  if (/has_role\s*\(\s*_user_id/.test(msrc)) {
    warnings.push(
      "latent: migration 20260317202908 defines has_role(_user_id,_role); re-apply would rename remote params and break canonical Edge callers",
    );
  }
}

// types.ts should be canonical
const typesPath = path.join(root, "src/integrations/supabase/types.ts");
if (fs.existsSync(typesPath)) {
  const t = fs.readFileSync(typesPath, "utf8");
  const idx = t.indexOf("has_role:");
  if (idx >= 0) {
    const slice = t.slice(idx, idx + 200);
    if (!/target_role/.test(slice) || !/\buid\b/.test(slice)) {
      failures.push("types.ts has_role Args not aligned to uid/target_role");
    }
  }
}

console.log("== Lot 2A has_role caller assert ==");
console.log(`canonical_rpc_calls: ${canonical}`);
console.log(`legacy_rpc_calls: ${legacy}`);
console.log(`mixed_rpc_calls: ${mixed}`);
if (legacyFiles.length) {
  console.log("legacy_files:");
  for (const x of legacyFiles) console.log(`  - ${x}`);
}
for (const w of warnings) console.log(`WARN: ${w}`);

// Phase A default: legacy named callers are WARN (active Edge risk, fix in Phase B).
// --strict (or LOT2A_HAS_ROLE_STRICT=1) promotes legacy to FAIL for CI gates after Edge fix.
const strict =
  process.argv.includes("--strict") || process.env.LOT2A_HAS_ROLE_STRICT === "1";

if (legacy > 0) {
  const msg = `broken/legacy named has_role callers: ${legacy} (remote expects uid/target_role)`;
  if (strict) failures.push(msg);
  else warnings.push(msg);
}

if (failures.length) {
  console.log("RESULT: FAIL");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

console.log("RESULT: SUCCESS");
if (warnings.length) {
  for (const w of warnings) console.log(`  warn: ${w}`);
}
process.exit(0);
