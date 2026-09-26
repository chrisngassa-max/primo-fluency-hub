#!/usr/bin/env node
/**
 * Generate proposed DROP/CREATE SQL for Lot 2A sous-lots from inventory JSON.
 * Does not apply anything remote.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inv = JSON.parse(
  fs.readFileSync(path.join(root, "docs/security/CAPTCF_LOT_02A_POLICIES_INVENTORY.json"), "utf8"),
);

function sqlLiteral(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function quoteIdent(s) {
  return '"' + String(s).replace(/"/g, '""') + '"';
}

function emitPolicy(p, toRole) {
  const lines = [];
  lines.push(`-- class=${p.class} table=${p.table}`);
  lines.push(`DROP POLICY IF EXISTS ${sqlLiteral(p.policy)} ON public.${quoteIdent(p.table)};`);
  const cmd = p.command === "ALL" ? "FOR ALL" : `FOR ${p.command}`;
  const permissive = p.permissive === "RESTRICTIVE" ? " AS RESTRICTIVE" : "";
  lines.push(`CREATE POLICY ${sqlLiteral(p.policy)}`);
  lines.push(`  ON public.${quoteIdent(p.table)}`);
  lines.push(`  AS ${p.permissive === "RESTRICTIVE" ? "RESTRICTIVE" : "PERMISSIVE"}`);
  lines.push(`  ${cmd}`);
  lines.push(`  TO ${toRole}`);
  if (p.using != null) lines.push(`  USING (${p.using})`);
  if (p.with_check != null) lines.push(`  WITH CHECK (${p.with_check})`);
  lines.push(";");
  lines.push("");
  return lines.join("\n");
}

function writeLot(filename, title, filterFn, toRole, extraHeader = "") {
  const policies = inv.policies.filter(filterFn);
  const parts = [];
  parts.push(`-- =============================================================================`);
  parts.push(`-- CAPTCF LOT 2A — PROPOSED (NOT APPLIED) — ${title}`);
  parts.push(`-- Generated from CAPTCF_LOT_02A_POLICIES_INVENTORY.json`);
  parts.push(`-- Count: ${policies.length}`);
  parts.push(`-- Target role clause: TO ${toRole}`);
  parts.push(`-- DO NOT place under supabase/migrations/ until owner-authorized.`);
  parts.push(`-- =============================================================================`);
  if (extraHeader) parts.push(extraHeader);
  parts.push("");
  for (const p of policies) parts.push(emitPolicy(p, toRole));
  parts.push(`SELECT 'lot2a_proposed_${filename}_ready'::text AS status;`);
  const out = path.join(root, "supabase/proposed/lot2a", filename);
  fs.writeFileSync(out, parts.join("\n"));
  console.log("wrote", filename, policies.length);
}

const isPublic = (p) => p.roles.includes("public");

writeLot(
  "02b_public_to_authenticated_scoped_FULL.sql",
  "B1 scoped {public} → TO authenticated",
  (p) => isPublic(p) && p.class === "correcte_role_implicite_vers_explicite",
  "authenticated",
  "-- EXCLUDES Sandbox RESTRICTIVE, service_role-destined, has_role-dependent, bare-true.",
);

writeLot(
  "03_public_service_destined_to_service_role_FULL.sql",
  "B2 service-destined {public} → TO service_role",
  (p) => isPublic(p) && p.class === "destinee_service_role",
  "service_role",
  "-- Policies named/checked for service_role but still attached to PUBLIC.",
);

writeLot(
  "04_public_has_role_profiles_to_authenticated_FULL.sql",
  "B3 has_role-dependent {public} → TO authenticated",
  (p) => isPublic(p) && p.class === "dependante_has_role",
  "authenticated",
  "-- Only the 3 profiles policies still on {public} with has_role. Coordinate with has_role Edge fix.",
);

writeLot(
  "05_public_hygiene_misc_to_authenticated_FULL.sql",
  "B4 misc hygiene {public} → TO authenticated",
  (p) => isPublic(p) && p.class === "hygiene_seulement",
  "authenticated",
);

// Rollback helpers: recreate TO public (empty roles)
function writeRollback(filename, title, filterFn) {
  const policies = inv.policies.filter(filterFn);
  const parts = [];
  parts.push(`-- ROLLBACK proposed for ${title} — restore TO public (default)`);
  parts.push(`-- Count: ${policies.length}`);
  parts.push("");
  for (const p of policies) {
    // PostgreSQL: omit TO clause ⇒ PUBLIC
    parts.push(`DROP POLICY IF EXISTS ${sqlLiteral(p.policy)} ON public.${quoteIdent(p.table)};`);
    const cmd = p.command === "ALL" ? "FOR ALL" : `FOR ${p.command}`;
    parts.push(`CREATE POLICY ${sqlLiteral(p.policy)}`);
    parts.push(`  ON public.${quoteIdent(p.table)}`);
    parts.push(`  AS ${p.permissive === "RESTRICTIVE" ? "RESTRICTIVE" : "PERMISSIVE"}`);
    parts.push(`  ${cmd}`);
    // no TO ⇒ PUBLIC
    if (p.using != null) parts.push(`  USING (${p.using})`);
    if (p.with_check != null) parts.push(`  WITH CHECK (${p.with_check})`);
    parts.push(";");
    parts.push("");
  }
  fs.writeFileSync(path.join(root, "supabase/proposed/lot2a", filename), parts.join("\n"));
  console.log("wrote rollback", filename, policies.length);
}

writeRollback(
  "02b_public_to_authenticated_scoped_ROLLBACK.sql",
  "B1",
  (p) => isPublic(p) && p.class === "correcte_role_implicite_vers_explicite",
);
writeRollback(
  "03_public_service_destined_to_service_role_ROLLBACK.sql",
  "B2",
  (p) => isPublic(p) && p.class === "destinee_service_role",
);
writeRollback(
  "04_public_has_role_profiles_to_authenticated_ROLLBACK.sql",
  "B3",
  (p) => isPublic(p) && p.class === "dependante_has_role",
);
writeRollback(
  "05_public_hygiene_misc_to_authenticated_ROLLBACK.sql",
  "B4",
  (p) => isPublic(p) && p.class === "hygiene_seulement",
);

console.log("done");
