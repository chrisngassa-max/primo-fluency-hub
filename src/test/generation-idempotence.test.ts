import { describe, expect, it } from "vitest";
import {
  isPostgresUniqueViolation,
  resolveForceRegenerateGate,
  resolveIdempotentConflictResponse,
  wouldReuseCachedFamily,
} from "../../supabase/functions/_shared/differentiation/generation-idempotence.ts";
import { CURRENT_CO_REFERENTIAL_VERSION } from "../../supabase/functions/_shared/differentiation/co-level-contract-loader.ts";

describe("generation idempotence / concurrency", () => {
  it("detects PostgreSQL 23505 unique violations", () => {
    expect(isPostgresUniqueViolation({ code: "23505" })).toBe(true);
    expect(isPostgresUniqueViolation({ message: "duplicate key value violates unique constraint \"idx_differentiation_families_idempotence\"" })).toBe(true);
    expect(isPostgresUniqueViolation({ code: "23503" })).toBe(false);
  });

  it("returns cached active family on 23505 when generated already exists", () => {
    const resolved = resolveIdempotentConflictResponse({
      id: "fam-1",
      generation_status: "generated",
      review_status: "draft",
      payload: { generated_levels: ["A1"] },
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body).toMatchObject({
      ok: true,
      cached: true,
      family_id: "fam-1",
      conflict_resolved: "unique_violation",
    });
  });

  it("returns stable 409 when generation already running after 23505", () => {
    const resolved = resolveIdempotentConflictResponse({
      id: "fam-running",
      generation_status: "generating",
      review_status: "draft",
    });
    expect(resolved.status).toBe(409);
    expect(resolved.body.error).toBe("FAMILY_GENERATION_ALREADY_RUNNING");
  });

  it("never allows force_regenerate to archive a published family", () => {
    expect(resolveForceRegenerateGate({
      id: "pub",
      generation_status: "generated",
      review_status: "published",
      published_exercise_id: "ex-1",
    })).toEqual({
      allowed: false,
      error: "FORCE_REGENERATE_BLOCKED_PUBLISHED",
      canArchive: false,
    });
  });

  it("allows archive only for non-published active family", () => {
    expect(resolveForceRegenerateGate({
      id: "draft",
      generation_status: "generated",
      review_status: "draft",
      published_exercise_id: null,
    })).toEqual({ allowed: true, canArchive: true });
  });

  it("documents allowed vs refused combinations", () => {
    // same source + A1 and A2 : allowed (different target_level in unique key)
    // same source + two identical active A1 : refused/idempotent via unique index + 23505 handler
    // archived A1 + new A1 : allowed (index excludes archived)
    // published A1 + force_regenerate : blocked
    expect(true).toBe(true);
  });

  it("never reuses a 1.1 family as 1.2 cache", () => {
    expect(wouldReuseCachedFamily("1.1", CURRENT_CO_REFERENTIAL_VERSION)).toBe(false);
    expect(wouldReuseCachedFamily(CURRENT_CO_REFERENTIAL_VERSION, CURRENT_CO_REFERENTIAL_VERSION)).toBe(true);
  });
});
