import { beforeEach, describe, expect, it } from "vitest";
import {
  fetchS01DemoContent,
  fetchS01DemoCorrection,
  releaseS01DemoCorrection,
  resetS01Demo,
  submitS01DemoAnswer,
} from "@/lib/curriculum/s01Demo";

describe("S01 demo without Supabase", () => {
  beforeEach(() => resetS01Demo());

  it.each(["A1", "A2", "B1", "B2"] as const)("returns only %s exercises", async (level) => {
    const content = await fetchS01DemoContent(level);
    const exercises = content.blocks.filter((block) => block.kind === "exercise");
    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises.every((exercise) => exercise.niveau_vise === level)).toBe(true);
  });

  it("never includes answers in learner content", async () => {
    const content = await fetchS01DemoContent("A2");
    expect(JSON.stringify(content)).not.toContain("bonne_reponse");
    expect(JSON.stringify(content)).not.toContain("explication");
  });

  it("keeps correction hidden until simulated trainer release", async () => {
    const content = await fetchS01DemoContent("A2");
    const exercise = content.blocks.find((block) => block.kind === "exercise");
    expect(exercise?.kind).toBe("exercise");
    if (!exercise || exercise.kind !== "exercise") return;
    const submitted = await submitS01DemoAnswer({ exerciseId: exercise.id, answers: { "0": "réponse test" } });
    const hidden = await fetchS01DemoCorrection(submitted.attempt_id);
    expect(hidden.released).toBe(false);
    expect(hidden.item_results).toBeUndefined();
    releaseS01DemoCorrection(submitted.attempt_id);
    const released = await fetchS01DemoCorrection(submitted.attempt_id);
    expect(released.released).toBe(true);
    expect(released.item_results).toBeDefined();
  });
});
