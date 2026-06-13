import { describe, expect, it } from "vitest";
import { getLearnerPrimaryAction } from "@/lib/learnerPrimaryAction";

describe("getLearnerPrimaryAction", () => {
  it("prioritizes the placement test for a new learner", () => {
    expect(getLearnerPrimaryAction({
      testLoading: false,
      testCompleted: false,
      pendingTestId: "bilan-1",
      session: { id: "session-1", remaining: 2 },
      homework: { id: "homework-1", expired: false },
    })?.path).toBe("/eleve/test-positionnement");
  });

  it("prioritizes trainer bilan before session and homework", () => {
    expect(getLearnerPrimaryAction({
      testLoading: false,
      testCompleted: true,
      pendingTestId: "bilan-1",
      session: { id: "session-1", remaining: 2 },
      homework: { id: "homework-1", expired: false },
    })?.path).toBe("/eleve/bilan-test/bilan-1");
  });

  it("returns the session before homework", () => {
    const action = getLearnerPrimaryAction({
      testLoading: false,
      testCompleted: true,
      session: { id: "session-1", remaining: 2 },
      homework: { id: "homework-1", expired: false },
    });
    expect(action?.path).toBe("/eleve/exercices-seance/session-1");
    expect(action?.description).toContain("2 activités");
  });

  it("returns null when the learner is up to date", () => {
    expect(getLearnerPrimaryAction({
      testLoading: false,
      testCompleted: true,
    })).toBeNull();
  });
});
