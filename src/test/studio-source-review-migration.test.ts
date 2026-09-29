import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("source review migration static contract (not database execution)", () => {
  const sql = readFileSync("supabase/migrations/20260929133719_secure_source_usability_review.sql", "utf8");
  const rollback = readFileSync("supabase/secours/20260929133719_secure_source_usability_review_rollback.sql", "utf8");
  it("limits the mutation, role and owner checks, locks and accepted transition", () => {
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("public.has_role(v_uid, 'formateur'::public.app_role)");
    expect(sql).toContain("v_source.created_by IS DISTINCT FROM v_uid");
    expect(sql).toContain("WHERE s.id=p_source_id FOR UPDATE");
    expect(sql).toContain("v_source.review_status NOT IN ('brouillon','utilisable')");
    expect(sql).toContain("v_source.updated_at IS DISTINCT FROM p_expected_updated_at");
    expect(sql).toContain("SET review_status='utilisable'");
    expect(sql).not.toMatch(/CREATE\s+(TABLE|POLICY)|ALTER\s+TABLE|INSERT\s+INTO|DELETE\s+FROM/i);
  });
  it("protects INSERT and UPDATE with effective role, not a spoofable flag", () => {
    expect(sql).toContain("RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER");
    expect(sql).toContain("current_user IN ('postgres', 'service_role')");
    expect(sql).toContain("BEFORE INSERT OR UPDATE OF review_status");
    expect(sql).not.toContain("current_setting(");
    expect(sql).toContain("OWNER TO postgres");
    expect(sql).toContain("SET search_path = pg_catalog");
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public.mark_pedagogical_source_usable.*FROM PUBLIC, anon, authenticated, service_role/);
    expect(sql.match(/GRANT EXECUTE[^;]+/g)).toEqual(["GRANT EXECUTE ON FUNCTION public.mark_pedagogical_source_usable(uuid,boolean,timestamptz) TO authenticated"]);
  });
  it("rollback drops only new objects safely and leaves original ACLs/data alone", () => {
    const statements = rollback.replace(/--[^\n]*/g, "");
    expect(statements).not.toMatch(/CASCADE|DELETE|UPDATE|GRANT|REVOKE/i);
    expect(statements.indexOf("DROP TRIGGER")).toBeLessThan(statements.indexOf("DROP FUNCTION"));
    expect(statements.match(/RESTRICT/g)).toHaveLength(2);
  });
});
