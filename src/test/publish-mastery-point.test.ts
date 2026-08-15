import { describe, expect, it } from "vitest";
import {
  isCoA2CompatibleMasteryPoint,
  isCoLevelCompatibleMasteryPoint,
  levelRank,
  pickDeterministicCoA2MasteryPoint,
  pickDeterministicCoMasteryPoint,
} from "../../supabase/functions/_shared/differentiation/publish-mastery-point.ts";

describe("publish mastery point selection", () => {
  it("orders CEFR levels with Pre-A1 below A0", () => {
    expect(levelRank("Pré-A1")).toBe(-1);
    expect(levelRank("Pre-A1")).toBe(-1);
    expect(levelRank("A0")).toBe(0);
    expect(levelRank("A1")).toBe(1);
    expect(levelRank("A2")).toBe(2);
    expect(levelRank("B1")).toBe(3);
    expect(levelRank("B2")).toBe(4);
    expect(levelRank("C1")).toBe(5);
    expect(levelRank("C2")).toBe(6);
    expect(levelRank("Z9")).toBeNull();
  });

  it("accepts A0-B1 and exact A2 ranges for CO", () => {
    expect(isCoA2CompatibleMasteryPoint({
      id: "point-a0-b1",
      niveau_min: "A0",
      niveau_max: "B1",
      sous_sections: { epreuves: { competence: "CO" } },
    })).toBe(true);

    expect(isCoA2CompatibleMasteryPoint({
      id: "point-a2-exact",
      niveau_min: "A2",
      niveau_max: "A2",
      sous_sections: { epreuves: { competence: "CO" } },
    })).toBe(true);
  });

  it("rejects B1-only, unknown bounds and non-CO points", () => {
    expect(isCoA2CompatibleMasteryPoint({
      id: "point-co-b1",
      niveau_min: "B1",
      niveau_max: "B2",
      sous_sections: { epreuves: { competence: "CO" } },
    })).toBe(false);

    expect(isCoA2CompatibleMasteryPoint({
      id: "point-unknown-bound",
      niveau_min: "A1",
      niveau_max: "Z9",
      sous_sections: { epreuves: { competence: "CO" } },
    })).toBe(false);

    expect(isCoA2CompatibleMasteryPoint({
      id: "point-ce-a2",
      niveau_min: "A1",
      niveau_max: "B1",
      sous_sections: { epreuves: { competence: "CE" } },
    })).toBe(false);
  });

  it("picks the same first compatible CO/A2 point deterministically", () => {
    const selected = pickDeterministicCoA2MasteryPoint([
      {
        id: "point-late",
        ordre: 9,
        niveau_min: "A0",
        niveau_max: "B1",
        sous_sections: { ordre: 4, epreuves: { competence: "CO", ordre: 3 } },
      },
      {
        id: "point-early",
        ordre: 1,
        niveau_min: "A2",
        niveau_max: "A2",
        sous_sections: { ordre: 1, epreuves: { competence: "CO", ordre: 1 } },
      },
      {
        id: "point-other-competence",
        ordre: 0,
        niveau_min: "A1",
        niveau_max: "A2",
        sous_sections: { ordre: 0, epreuves: { competence: "CE", ordre: 0 } },
      },
      {
        id: "point-incompatible",
        ordre: 0,
        niveau_min: "B1",
        niveau_max: "B2",
        sous_sections: { ordre: 0, epreuves: { competence: "CO", ordre: 0 } },
      },
    ]);

    expect(selected?.id).toBe("point-early");

    const again = pickDeterministicCoA2MasteryPoint([
      {
        id: "point-late",
        ordre: 9,
        niveau_min: "A0",
        niveau_max: "B1",
        sous_sections: { ordre: 4, epreuves: { competence: "CO", ordre: 3 } },
      },
      {
        id: "point-early",
        ordre: 1,
        niveau_min: "A2",
        niveau_max: "A2",
        sous_sections: { ordre: 1, epreuves: { competence: "CO", ordre: 1 } },
      },
    ]);
    expect(again?.id).toBe("point-early");
  });

  it("selects CO mastery points for A1/B1/B2 targets", () => {
    const points = [
      {
        id: "point-a1",
        ordre: 1,
        niveau_min: "A1",
        niveau_max: "A1",
        sous_sections: { ordre: 1, epreuves: { competence: "CO", ordre: 1 } },
      },
      {
        id: "point-a2",
        ordre: 2,
        niveau_min: "A2",
        niveau_max: "A2",
        sous_sections: { ordre: 1, epreuves: { competence: "CO", ordre: 1 } },
      },
      {
        id: "point-b1",
        ordre: 3,
        niveau_min: "B1",
        niveau_max: "B1",
        sous_sections: { ordre: 2, epreuves: { competence: "CO", ordre: 1 } },
      },
      {
        id: "point-b2",
        ordre: 4,
        niveau_min: "B2",
        niveau_max: "B2",
        sous_sections: { ordre: 2, epreuves: { competence: "CO", ordre: 1 } },
      },
      {
        id: "point-wide",
        ordre: 0,
        niveau_min: "A0",
        niveau_max: "B2",
        sous_sections: { ordre: 0, epreuves: { competence: "CO", ordre: 0 } },
      },
    ];
    expect(pickDeterministicCoMasteryPoint(points, "A1")?.id).toBe("point-a1");
    expect(pickDeterministicCoMasteryPoint(points, "A2")?.id).toBe("point-a2");
    expect(pickDeterministicCoMasteryPoint(points, "B1")?.id).toBe("point-b1");
    expect(pickDeterministicCoMasteryPoint(points, "B2")?.id).toBe("point-b2");
  });

  it("returns null instead of unrelated fallback when no CO coverage exists", () => {
    expect(pickDeterministicCoMasteryPoint([
      {
        id: "point-ce",
        niveau_min: "A1",
        niveau_max: "B2",
        sous_sections: { epreuves: { competence: "CE" } },
      },
    ], "B1")).toBeNull();
  });
});
