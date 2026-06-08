import { describe, expect, it } from "vitest";
import { lowestBaselineLevel, resultsSinceBaseline } from "@/lib/studentLevelBaseline";

describe("student level baseline", () => {
  it("uses the lowest official skill as the overall reference", () => {
    expect(lowestBaselineLevel({ co: "B1", ce: "A2", ee: "B1", eo: "B2" })).toBe("A2");
  });

  it("ignores results produced before the new baseline", () => {
    const results = [
      { score: 40, createdAt: "2026-05-01T10:00:00Z" },
      { score: 75, createdAt: "2026-06-05T10:00:00Z" },
    ];
    expect(resultsSinceBaseline(results, "2026-06-01T00:00:00Z")).toEqual([results[1]]);
  });
});
