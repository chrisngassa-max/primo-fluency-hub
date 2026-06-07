import { describe, expect, it } from "vitest";
import {
  ORAL_CRITERIA,
  emptyOralCriteria,
  normalizeOralCriteria,
} from "../../supabase/functions/_shared/oral-evaluation";

describe("oral evaluation normalization", () => {
  it("returns all six criteria and clamps scores", () => {
    const result = normalizeOralCriteria({
      lexique: { score: 12, commentaire: "Varié" },
      fluidite: { score: -2, commentaire: "Hésitations" },
    }, 10);

    expect(Object.keys(result)).toEqual([...ORAL_CRITERIA]);
    expect(result.lexique).toEqual({ score: 10, commentaire: "Varié" });
    expect(result.fluidite.score).toBe(0);
    expect(result.grammaire).toEqual({ score: 0, commentaire: "" });
  });

  it("builds a complete empty evaluation", () => {
    expect(Object.keys(emptyOralCriteria())).toHaveLength(6);
  });
});
