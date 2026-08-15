import { describe, expect, it, vi } from "vitest";
import {
  generateDifferentiationFamiliesForLevels,
  pickLatestFamilyPerLevel,
  getFamilyTargetLevel,
  type DifferentiationFamily,
  type SliceLevel,
} from "@/lib/differentiationFamilies";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;

describe("differentiationFamilies multilevel orchestration", () => {
  it("maps latest family per level without overwrite confusion", () => {
    const families = [
      { id: "1", payload: { generated_levels: ["B1"] }, target_level: "B1" },
      { id: "2", payload: { generated_levels: ["A2"] }, target_level: "A2" },
      { id: "3", payload: { variants: { A2: {} } }, target_level: null },
    ] as DifferentiationFamily[];
    const byLevel = pickLatestFamilyPerLevel(families);
    expect(byLevel.B1?.id).toBe("1");
    expect(byLevel.A2?.id).toBe("2");
    expect(getFamilyTargetLevel(families[2])).toBe("A2");
  });

  it("runs single and multi selection with separate progress and isolated failures", async () => {
    supabase.functions.invoke = vi.fn(async (_name: string, args: { body: { target_level: SliceLevel } }) => {
      if (args.body.target_level === "B2") {
        return {
          data: {
            error: "DIFF_TRANSFORMATION_NOT_SUPPORTED",
            message: "Cette ressource ne contient pas assez d’éléments pour produire une activité B2 fiable. Essayez B1 ou choisissez un support plus riche.",
            support_compatibility: { supported: false },
          },
          error: null,
        };
      }
      return {
        data: {
          ok: true,
          family_id: `fam-${args.body.target_level}`,
          target_level: args.body.target_level,
          support_compatibility: { supported: true },
        },
        error: null,
      };
    });

    const results = await generateDifferentiationFamiliesForLevels("source-1", ["A1", "A2", "B2"], {
      concurrency: 1,
    });

    expect(results).toHaveLength(3);
    expect(results.find((entry) => entry.level === "A1")).toMatchObject({ ok: true });
    expect(results.find((entry) => entry.level === "A2")).toMatchObject({ ok: true });
    expect(results.find((entry) => entry.level === "B2")).toMatchObject({
      ok: false,
      error: "DIFF_TRANSFORMATION_NOT_SUPPORTED",
    });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(3);
  });

  it("keeps publication calls independent per family id", async () => {
    const published: string[] = [];
    supabase.functions.invoke = vi.fn(async (name: string, args: { body: { familyId: string } }) => {
      if (name !== "publish-differentiation-family") return { data: {}, error: null };
      if (published.includes(args.body.familyId)) {
        return { data: { error: "FAMILY_ALREADY_PUBLISHED" }, error: null };
      }
      published.push(args.body.familyId);
      return { data: { exercise_id: `ex-${args.body.familyId}`, target_level: "A2" }, error: null };
    });

    const { publishDifferentiationFamily } = await import("@/lib/differentiationFamilies");
    await expect(publishDifferentiationFamily("fam-a1")).resolves.toMatchObject({ exercise_id: "ex-fam-a1" });
    await expect(publishDifferentiationFamily("fam-a2")).resolves.toMatchObject({ exercise_id: "ex-fam-a2" });
    await expect(publishDifferentiationFamily("fam-a1")).rejects.toThrow("FAMILY_ALREADY_PUBLISHED");
  });
});
