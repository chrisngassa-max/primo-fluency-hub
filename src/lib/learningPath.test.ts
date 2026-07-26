import { describe, expect, it } from "vitest";
import { resolveLearningPathOutcome } from "./learningPath";

describe("resolveLearningPathOutcome", () => {
  it("oriente sous 60 vers la remediation", () => {
    expect(resolveLearningPathOutcome(59, null, 2, 3)).toEqual(expect.objectContaining({ decision: "remediation", nextStepOrder: 1 }));
  });

  it("oriente de 60 a 79 vers la consolidation", () => {
    expect(resolveLearningPathOutcome(60, null, 1, 3)).toEqual(expect.objectContaining({ decision: "consolidation", nextStepOrder: 2 }));
    expect(resolveLearningPathOutcome(79, null, 2, 3)).toEqual(expect.objectContaining({ decision: "consolidation", nextStepOrder: 3 }));
  });

  it("oriente a partir de 80 vers une extension", () => {
    expect(resolveLearningPathOutcome(80, null, 1, 3)).toEqual(expect.objectContaining({ decision: "extension", nextStepOrder: 3 }));
  });

  it("termine le parcours quand aucune etape suivante n existe", () => {
    expect(resolveLearningPathOutcome(80, null, 2, 3).nextStepOrder).toBeNull();
    expect(resolveLearningPathOutcome(70, null, 3, 3).nextStepOrder).toBeNull();
  });});