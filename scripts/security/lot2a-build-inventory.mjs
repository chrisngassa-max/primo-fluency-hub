#!/usr/bin/env node
/**
 * Lot 2A Phase A — build classified RLS policy inventory from raw remote export.
 * Read-only local processing; does not touch remote.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "docs/security/_lot2a_policies_raw.json");
const GRANTS_MCP =
  process.env.LOT2A_GRANTS_FILE ||
  "C:/Users/Sofiane/.cursor/projects/d-sites-tcf-pro/agent-tools/32441baa-1946-4913-b3db-48611421583e.txt";

function parseRoles(r) {
  if (Array.isArray(r)) return r.map(String);
  if (r == null) return [];
  const s = String(r).trim();
  if (s === "" || s === "{}") return []; // empty polroles ≡ PUBLIC
  const inner = s.replace(/^\{/, "").replace(/\}$/, "");
  if (!inner) return [];
  return inner
    .split(",")
    .map((x) => x.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
}

function isBareTrue(expr) {
  if (!expr) return false;
  const e = String(expr).replace(/\s+/g, "").toLowerCase();
  return e === "true" || e === "(true)";
}

function loadGrants(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  let grants;
  try {
    const outer = JSON.parse(raw);
    const m = String(outer.result).match(/<untrusted-data-[^>]+>\n([\s\S]*?)\n<\/untrusted-data-/);
    grants = JSON.parse(m[1]);
  } catch {
    grants = JSON.parse(raw);
  }
  const grantMap = {};
  for (const g of grants) {
    grantMap[g.table_name] = grantMap[g.table_name] || {};
    grantMap[g.table_name][g.grantee] = g.privileges;
  }
  return grantMap;
}

function classify(p, grantMap) {
  const name = p.policy_name || "";
  const u = p.using_expr;
  const w = p.with_check_expr;
  const expr = [u, w].filter(Boolean).join(" ");
  const roles = parseRoles(p.roles);
  const hasRole = /has_role\s*\(/i.test(expr);
  const eitherBareTrue = isBareTrue(u) || isBareTrue(w);
  const serviceNamed =
    /^service_/i.test(name) ||
    /service_role/i.test(name) ||
    /_service_/i.test(name) ||
    /Service role/i.test(name);
  const serviceRoleCheck = /auth\.role\(\)\s*=\s*'service_role'/i.test(expr);
  const sandbox = /sandbox isolation/i.test(name);
  const g = grantMap[p.table_name] || {};
  const hasAnon = !!g.anon;
  const isPublicRole = roles.length === 0 || roles.includes("public");

  if (sandbox && p.permissive === "RESTRICTIVE") return "conserver_sandbox_restrictive";
  if ((serviceNamed && eitherBareTrue && !hasRole) || serviceRoleCheck) return "destinee_service_role";
  if (hasRole) return "dependante_has_role";
  if (eitherBareTrue) {
    if (hasAnon) return "suspecte_critique";
    return "trop_large_authenticated";
  }
  if (isPublicRole) {
    if (/auth\.uid\(\)/i.test(expr) || /can_access_/i.test(expr)) {
      return "correcte_role_implicite_vers_explicite";
    }
    return "hygiene_seulement";
  }
  // already TO authenticated / specific — keep
  return "a_conserver";
}

const policies = JSON.parse(fs.readFileSync(RAW, "utf8"));
const grantMap = loadGrants(GRANTS_MCP);

const roleDist = {};
for (const p of policies) {
  const roles = parseRoles(p.roles);
  const key = roles.length ? roles.sort().join(",") : "PUBLIC";
  roleDist[key] = (roleDist[key] || 0) + 1;
}

const classes = {};
const rows = policies.map((p) => {
  const roles = parseRoles(p.roles);
  const displayRoles = roles.length ? roles : ["public"];
  const g = grantMap[p.table_name] || {};
  const cls = classify(p, grantMap);
  classes[cls] = (classes[cls] || 0) + 1;
  return {
    table: p.table_name,
    policy: p.policy_name,
    command: p.command,
    permissive: p.permissive,
    roles: displayRoles,
    using: p.using_expr,
    with_check: p.with_check_expr,
    grants: {
      anon: g.anon || null,
      authenticated: g.authenticated || null,
      service_role: g.service_role || null,
    },
    has_role: /has_role\s*\(/i.test([p.using_expr, p.with_check_expr].filter(Boolean).join(" ")),
    class: cls,
    rls_enabled: p.rls_enabled,
    rls_forced: p.rls_forced,
  };
});

const publicCount = rows.filter((r) => r.roles.length === 1 && r.roles[0] === "public").length;

const outJson = {
  generated_at_utc: new Date().toISOString(),
  project_id: "gudcenhmzlcvhgbgklzw",
  policy_count: rows.length,
  table_count: new Set(rows.map((r) => r.table)).size,
  role_distribution: roleDist,
  public_role_policy_count: publicCount,
  class_counts: classes,
  lot07_reported_count: 113,
  discrepancy_note:
    "Lot 0.7 evidence reported 113 {public} policies / 46 tables. Full remote pg_policy scan yields " +
    rows.length +
    " policies / " +
    new Set(rows.map((r) => r.table)).size +
    " tables. Empty polroles ≡ {public}. Lot 2A uses the full inventory; Lot 0.7 figure treated as partial until reconciled.",
  policies: rows,
};

fs.mkdirSync(path.join(ROOT, "docs/security"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "docs/security/CAPTCF_LOT_02A_POLICIES_INVENTORY.json"),
  JSON.stringify(outJson, null, 2),
);

const lines = [];
lines.push("# CAPTCF Lot 2A — Inventaire policies RLS (remote)");
lines.push("");
lines.push("**Projet:** `gudcenhmzlcvhgbgklzw`  ");
lines.push(`**Généré:** ${outJson.generated_at_utc}  `);
lines.push(
  `**Total policies:** ${rows.length} sur ${outJson.table_count} tables (dont **${publicCount}** avec rôle \`{public}\`)  `,
);
lines.push("");
lines.push("## Distribution des rôles policy");
lines.push("");
lines.push("| Rôles | Count |");
lines.push("|---|---:|");
for (const [k, v] of Object.entries(roleDist).sort((a, b) => b[1] - a[1])) {
  lines.push(`| \`${k}\` | ${v} |`);
}
lines.push("");
lines.push("## Counts par classe");
lines.push("");
lines.push("| Classe | Count |");
lines.push("|---|---:|");
for (const [k, v] of Object.entries(classes).sort((a, b) => b[1] - a[1])) {
  lines.push(`| ${k} | ${v} |`);
}
lines.push("");
lines.push("## Note Lot 0.7");
lines.push("");
lines.push(outJson.discrepancy_note);
lines.push("");
lines.push("## Sandbox RESTRICTIVE (conserver — Lot 0.8B)");
lines.push("");
for (const r of rows.filter((x) => x.class === "conserver_sandbox_restrictive")) {
  lines.push(`- \`${r.table}\`.\`${r.policy}\` ${r.command} ${r.permissive}`);
}
lines.push("");
lines.push("## Trop larges (USING/CHECK true, hors service nommé)");
lines.push("");
for (const r of rows.filter((x) => x.class === "trop_large_authenticated")) {
  lines.push(
    `- \`${r.table}\`.\`${r.policy}\` [${r.command}] roles=${r.roles.join(",")} anon_grant=${r.grants.anon || "none"}`,
  );
}
lines.push("");
lines.push("## Destinées service_role");
lines.push("");
for (const r of rows.filter((x) => x.class === "destinee_service_role")) {
  lines.push(`- \`${r.table}\`.\`${r.policy}\` [${r.command}]`);
}
lines.push("");
lines.push("## Suspectes critiques (true + GRANT anon)");
lines.push("");
const sus = rows.filter((x) => x.class === "suspecte_critique");
if (sus.length === 0) {
  lines.push("_Aucune combo USING/CHECK true + GRANT anon détectée (confinement Lot 0.6)._");
} else {
  for (const r of sus) lines.push(`- \`${r.table}\`.\`${r.policy}\``);
}
lines.push("");
lines.push("## Fichier machine");
lines.push("");
lines.push("Voir `CAPTCF_LOT_02A_POLICIES_INVENTORY.json` (entrées complètes).");
lines.push("");

fs.writeFileSync(path.join(ROOT, "docs/security/CAPTCF_LOT_02A_POLICIES_INVENTORY.md"), lines.join("\n"));

console.log(
  JSON.stringify(
    {
      policy_count: rows.length,
      public_role_policy_count: publicCount,
      role_distribution: roleDist,
      class_counts: classes,
    },
    null,
    2,
  ),
);
