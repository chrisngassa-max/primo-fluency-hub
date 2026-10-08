// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import {
  generateDifferentiationFamily,
  generateDifferentiationFamiliesForLevels,
  type SliceLevel,
} from "@/lib/differentiationFamilies";
import { assertGenerationAllowed } from "@/lib/studioAudioWorkflow";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, from: vi.fn() },
}));
import { supabase } from "@/integrations/supabase/client";
const invoke = vi.mocked(supabase.functions.invoke);
const levels: SliceLevel[] = ["A1", "A2", "B1", "B2"];
const sourceId = "eclipse-test-source";

beforeEach(() => {
  vi.resetAllMocks();
  invoke.mockResolvedValue({ data: { family_id: "draft-test" }, error: null });
});

describe("Studio generation payload contract", () => {
  it.each(levels)("%s always sends the bounded shared-facts body, without a client hash", async (targetLevel) => {
    // Runtime extras must never leak into the body, even from an untyped caller.
    await generateDifferentiationFamily(sourceId, {
      targetLevel, correctif_05a_c: false, facts_hash: "untrusted", facts: [],
    } as any);
    expect(invoke.mock.calls).toEqual([["generate-differentiation-family", {
      body: { sourceId, target_level: targetLevel, force_regenerate: false, correctif_05a_c: true },
    }]]);
  });

  it("keeps the default A2 and explicit regeneration in bounded mode", async () => {
    await generateDifferentiationFamily(sourceId, { forceRegenerate: true });
    expect(invoke).toHaveBeenCalledExactlyOnceWith("generate-differentiation-family", {
      body: { sourceId, target_level: "A2", force_regenerate: true, correctif_05a_c: true },
    });
  });

  it("all Studio orchestration calls activate correctif_05a_c and never publish", async () => {
    await generateDifferentiationFamiliesForLevels(sourceId, levels, { concurrency: 1 });
    expect(invoke.mock.calls).toEqual(levels.map((target_level) => ["generate-differentiation-family", {
      body: { sourceId, target_level, force_regenerate: false, correctif_05a_c: true },
    }]));
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it.each(levels)("%s server failure makes one attempt; one explicitly piloted retry makes exactly one more", async (level) => {
    invoke.mockResolvedValue({ data: null, error: new Error("transient test error") });
    const first = await generateDifferentiationFamiliesForLevels(sourceId, [level, level]);
    expect(first).toMatchObject([{ level, ok: false }]);
    expect(invoke).toHaveBeenCalledTimes(1);
    // The pilot, not an automatic loop, authorizes this single retry.
    const retry = await generateDifferentiationFamiliesForLevels(sourceId, [level]);
    expect(retry).toMatchObject([{ level, ok: false }]);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it.each(["A1", "B1", "B2"] as const)("%s remains blocked before facts confirmation", (level) => {
    const result = assertGenerationAllowed({
      source: { id: sourceId, source_kind: "audio", status: "analyzed", review_status: "utilisable", rights_status: "internal_pilot", reusable_for_ai: true } as any,
      transcriptionStatus: "reviewed",
      selectedLevels: [level],
      confirmation: null,
      families: [{ payload: { facts: { facts_hash: "sha256:test", required: [{ fact_id: "f1" }] } } }] as any,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Confirmez/i);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("routes every frontend generate endpoint call through the tested shared helper", () => {
    function files(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? files(path) : /\.tsx?$/.test(path) && !/\.(test|spec)\./.test(path) ? [path] : [];
      });
    }
    const callers = files(join(process.cwd(), "src")).filter((path) =>
      /["']generate-differentiation-family["']/.test(readFileSync(path, "utf8")));
    expect(callers.map((path) => relative(process.cwd(), path).replaceAll("\\", "/")))
      .toEqual(["src/lib/differentiationFamilies.ts", "src/lib/studioFactsRevision.ts"]);
    // The second caller is revision-only, not an alternate generation payload.
    const revision = readFileSync("src/lib/studioFactsRevision.ts", "utf8");
    expect(revision).toContain("action:'revise_facts'");
    expect(revision).not.toContain("target_level");
    const actions = readFileSync("src/components/pedagogical-sources/SourceDifferentiationFamilyActions.tsx", "utf8");
    expect(actions).toContain("await generateDifferentiationFamiliesForLevels(source.id, selectedLevels");
    const wizard = readFileSync("src/pages/formateur/StudioAudioWizardPage.tsx", "utf8");
    expect(wizard).toContain("<SourceDifferentiationFamilyActions");
    expect(wizard).toContain("assertGenerationAllowed({");
  });
});
