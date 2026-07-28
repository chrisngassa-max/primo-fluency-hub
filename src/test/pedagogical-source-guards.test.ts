import { describe, expect, it } from "vitest";
import {
  getPedagogicalSourceAccessError,
  getPedagogicalSourceReadinessError,
  isPedagogicalSourceReadyForDifferentiation,
} from "../../supabase/functions/_shared/pedagogical-source-guards.ts";

describe("pedagogical source guards", () => {
  it("requires staff role before analyzing a source", () => {
    expect(getPedagogicalSourceAccessError({
      isStaff: false,
      isAdmin: false,
      userId: "learner-1",
      source: { id: "source-1", created_by: "learner-1" },
    })).toBe("STAFF_ROLE_REQUIRED");
  });

  it("refuses analysis of a missing source", () => {
    expect(getPedagogicalSourceAccessError({
      isStaff: true,
      isAdmin: false,
      userId: "trainer-1",
      source: null,
    })).toBe("SOURCE_NOT_FOUND");
  });

  it("refuses analysis of another trainer source", () => {
    const result = getPedagogicalSourceAccessError({
      isStaff: true,
      isAdmin: false,
      userId: "trainer-1",
      source: { id: "source-1", created_by: "trainer-2" },
    });

    expect(result).toBe("SOURCE_FORBIDDEN");
  });

  it("allows owner trainer and admin on foreign source", () => {
    expect(getPedagogicalSourceAccessError({
      isStaff: true,
      isAdmin: false,
      userId: "trainer-1",
      source: { id: "source-1", created_by: "trainer-1" },
    })).toBeNull();

    expect(getPedagogicalSourceAccessError({
      isStaff: false,
      isAdmin: true,
      userId: "admin-1",
      source: { id: "source-1", created_by: "trainer-2" },
    })).toBeNull();
  });

  it("requires analyzed and trainer-approved sources for differentiation", () => {
    expect(getPedagogicalSourceReadinessError({
      status: "imported",
      review_status: "utilisable",
    })).toBe("SOURCE_NOT_ANALYZED");

    expect(getPedagogicalSourceReadinessError({
      status: "analyzed",
      review_status: "brouillon",
    })).toBe("SOURCE_REVIEW_NOT_APPROVED");

    expect(getPedagogicalSourceReadinessError({
      status: "analyzed",
      review_status: "a_remplacer",
    })).toBe("SOURCE_REVIEW_NOT_APPROVED");

    expect(getPedagogicalSourceReadinessError({
      status: "analyzed",
      review_status: "valide",
    })).toBeNull();

    expect(isPedagogicalSourceReadyForDifferentiation({
      status: "analyzed",
      review_status: "utilisable",
    })).toBe(true);
  });
});
