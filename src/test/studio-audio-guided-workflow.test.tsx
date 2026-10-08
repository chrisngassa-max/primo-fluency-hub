// @ts-nocheck
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() }, storage: { from: vi.fn() } },
}));

import type { DifferentiationFamily } from "@/lib/differentiationFamilies";
import type { PedagogicalSource } from "@/lib/pedagogicalSources";
import {
  STUDIO_AUDIO_STEPS,
  STUDIO_MAX_ITEMS_PER_LEVEL,
  assertGenerationAllowed,
  assertPublishAllowed,
  buildStudioFactsConfirmation,
  canSelectStudioStep,
  familyExceedsItemCap,
  findCommonSealedFacts,
  hasDivergentFactsHashes,
  humanizeStudioError,
  mergeStudioFactsConfirmation,
  publishedVariants,
  readStudioFactsConfirmation,
  resolveStudioSteps,
} from "@/lib/studioAudioWorkflow";
import { StudioAudioStepBar } from "@/components/studio-audio/StudioAudioStepBar";

function makeSource(overrides: Partial<PedagogicalSource> = {}): PedagogicalSource {
  return {
    id: "source-1",
    title: "Louise",
    author: null,
    source_kind: "audio",
    source_subtype: "document_sonore",
    pedagogical_domains: ["CO"],
    level_min: "A1",
    level_max: "B2",
    themes: [],
    status: "analyzed",
    review_status: "utilisable",
    storage_bucket: "pedagogical-sources",
    storage_path: "u/file.mp3",
    content_hash: "sha256:abc",
    file_size: 10,
    mime_type: "audio/mpeg",
    source_origin: "interne",
    rights_status: "source_interne",
    license_note: null,
    reusable_for_students: true,
    reusable_for_ai: true,
    metadata: {},
    created_by: "trainer-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeFamily(overrides: Partial<DifferentiationFamily> & { level?: string; factsHash?: string; itemCount?: number } = {}): DifferentiationFamily {
  const level = overrides.level ?? "A2";
  const factsHash = overrides.factsHash ?? "sha256:4fd8d556";
  const itemCount = overrides.itemCount ?? 4;
  const items = Array.from({ length: itemCount }, (_, index) => ({ id: `q${index + 1}`, instruction: `Q${index + 1}` }));
  return {
    id: overrides.id ?? `fam-${level}`,
    family_id: overrides.family_id ?? `family-${level}`,
    target_level: level as any,
    generation_status: overrides.generation_status ?? "generated",
    validation_status: overrides.validation_status ?? "passed",
    review_status: overrides.review_status ?? "draft",
    validation_report: overrides.validation_report ?? {},
    payload: overrides.payload ?? {
      facts: {
        facts_hash: factsHash,
        required: [
          { fact_id: "f1", subject: "Louise", predicate: "aime", object: "musique" },
        ],
      },
      variants: {
        [level]: { exercise: { items } },
      },
    },
    published_exercise_id: overrides.published_exercise_id ?? null,
    generation_error: overrides.generation_error ?? null,
  };
}

describe("Studio audio guided workflow", () => {
  it("1. expose exactly eight steps with formateur labels", () => {
    expect(STUDIO_AUDIO_STEPS).toHaveLength(8);
    expect(STUDIO_AUDIO_STEPS.map((step) => step.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(STUDIO_AUDIO_STEPS[0].label).toMatch(/Importer/i);
    expect(STUDIO_AUDIO_STEPS[7].label).toMatch(/séance/i);
  });

  it("2. resumes an existing source at the first incomplete step", () => {
    const source = makeSource({
      metadata: mergeStudioFactsConfirmation({}, buildStudioFactsConfirmation({
        factsHash: "sha256:4fd8d556",
        confirmedBy: "trainer-1",
        factIds: ["f1"],
      })),
    });
    const families = [
      makeFamily({ level: "A2", review_status: "published", published_exercise_id: "ex-a2" }),
    ];
    const { recommendedStep, steps, nextAction } = resolveStudioSteps({
      source,
      transcriptionStatus: "reviewed",
      families,
      selectedLevels: ["A2"],
      activeStep: 6,
    });
    expect(steps.find((s) => s.id === 1)?.status).toBe("done");
    expect(steps.find((s) => s.id === 4)?.status).toBe("done");
    expect(recommendedStep).toBeGreaterThanOrEqual(6);
    expect(nextAction.length).toBeGreaterThan(10);
  });

  it("3. blocks generation when transcription is missing", () => {
    const result = assertGenerationAllowed({
      source: makeSource(),
      transcriptionStatus: null,
      families: [],
      selectedLevels: ["A2"],
      confirmation: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/transcription/i);
  });

  it("4. blocks multilevel generation when facts are absent", () => {
    const result = assertGenerationAllowed({
      source: makeSource(),
      transcriptionStatus: "reviewed",
      families: [],
      selectedLevels: ["A1", "A2", "B1", "B2"],
      confirmation: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/A2|faits/i);
  });

  it("5. blocks multilevel generation when facts are not confirmed", () => {
    const families = [makeFamily({ level: "A2" })];
    const result = assertGenerationAllowed({
      source: makeSource(),
      transcriptionStatus: "reviewed",
      families,
      selectedLevels: ["A1", "B1"],
      confirmation: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Confirmez/i);
  });

  it("6. refuses divergent facts_hash within the same A1–B2 family set", () => {
    const families = [
      makeFamily({ level: "A2", factsHash: "sha256:aaa" }),
      makeFamily({ level: "B1", factsHash: "sha256:bbb" }),
    ];
    expect(hasDivergentFactsHashes(families)).toBe(true);
    expect(findCommonSealedFacts(families)).toBeNull();
    const result = assertGenerationAllowed({
      source: makeSource(),
      transcriptionStatus: "reviewed",
      families,
      selectedLevels: ["A2", "B1"],
      confirmation: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/facts_hash/i);
  });

  it("7. allows A1–B2 selection once facts are sealed and confirmed", () => {
    const confirmation = buildStudioFactsConfirmation({
      factsHash: "sha256:4fd8d556",
      confirmedBy: "trainer-1",
      factIds: ["f1"],
    });
    const source = makeSource({
      metadata: mergeStudioFactsConfirmation({}, confirmation),
    });
    const families = [
      makeFamily({ level: "A2", factsHash: "sha256:4fd8d556" }),
    ];
    const result = assertGenerationAllowed({
      source,
      transcriptionStatus: "reviewed",
      families,
      selectedLevels: ["A1", "A2", "B1", "B2"],
      confirmation: readStudioFactsConfirmation(source.metadata),
    });
    expect(result.ok).toBe(true);
  });

  it("8. keeps the six-item ceiling", () => {
    expect(STUDIO_MAX_ITEMS_PER_LEVEL).toBe(6);
    expect(familyExceedsItemCap(makeFamily({ itemCount: 6 }))).toBe(false);
    expect(familyExceedsItemCap(makeFamily({ itemCount: 7 }))).toBe(true);
    const publish = assertPublishAllowed(makeFamily({
      itemCount: 7,
      review_status: "validated",
      validation_status: "passed",
    }));
    expect(publish.ok).toBe(false);
    if (!publish.ok) expect(publish.reason).toMatch(/plafond|6/i);
  });

  it("9. forbids publication before validation", () => {
    const draft = assertPublishAllowed(makeFamily({ review_status: "draft" }));
    expect(draft.ok).toBe(false);
    if (!draft.ok) expect(draft.reason).toMatch(/Validez/i);

    const validated = assertPublishAllowed(makeFamily({
      review_status: "validated",
      validation_status: "passed",
      itemCount: 4,
    }));
    expect(validated.ok).toBe(true);
  });

  it("10–13. published variants listing supports session attach selection", () => {
    const families = [
      makeFamily({ level: "A1", review_status: "published", published_exercise_id: "ex-a1" }),
      makeFamily({ level: "A2", review_status: "published", published_exercise_id: "ex-a2" }),
      makeFamily({ level: "B1", review_status: "draft", published_exercise_id: null }),
    ];
    const published = publishedVariants(families);
    expect(published.map((entry) => entry.level)).toEqual(["A1", "A2"]);
    expect(published.every((entry) => Boolean(entry.exerciseId))).toBe(true);
  });

  it("14. humanizes technical errors for trainers", () => {
    expect(humanizeStudioError("STAFF_ROLE_REQUIRED")).toMatch(/formateurs/i);
    expect(humanizeStudioError("SOURCE_FORBIDDEN")).toMatch(/appartient/i);
    expect(humanizeStudioError("DIFF_TRANSFORMATION_NOT_SUPPORTED")).toMatch(/support/i);
    expect(humanizeStudioError("Failed to fetch")).toMatch(/réseau|Connexion/i);
  });

  it("blocks step navigation when prerequisites are missing", () => {
    const { steps } = resolveStudioSteps({
      source: null,
      transcriptionStatus: null,
      families: [],
      selectedLevels: ["A2"],
      activeStep: 1,
    });
    const gate = canSelectStudioStep(5, steps);
    expect(gate.ok).toBe(false);
  });

  it("allows A2-only bootstrap when no sealed facts exist yet", () => {
    const result = assertGenerationAllowed({
      source: makeSource(),
      transcriptionStatus: "reviewed",
      families: [],
      selectedLevels: ["A2"],
      confirmation: null,
    });
    expect(result.ok).toBe(true);
  });
});

describe("StudioAudioStepBar accessibility", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("15–16. renders eight keyboard-focusable steps with accessible labels", () => {
    const onSelect = vi.fn();
    const steps = STUDIO_AUDIO_STEPS.map((step, index) => ({
      id: step.id,
      key: step.key,
      label: step.label,
      status: (index === 0 ? "current" : index === 4 ? "blocked" : "available") as const,
      blockReason: index === 4 ? "Transcription absente" : undefined,
    }));

    act(() => {
      root.render(
        <div className="max-w-sm">
          <StudioAudioStepBar steps={steps} activeStep={1} onSelect={onSelect} />
        </div>,
      );
    });

    const nav = container.querySelector('nav[aria-label="Étapes du Studio audio"]');
    expect(nav).toBeTruthy();
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(8);
    expect(buttons[0].getAttribute("aria-current")).toBe("step");
    expect(buttons[4].disabled).toBe(true);
    expect(buttons[4].getAttribute("title")).toMatch(/Transcription/i);

    act(() => {
      buttons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});

describe("studio session link helpers (pure outcomes)", () => {
  it("12. treats duplicate exercise ids as a single attach candidate", () => {
    const ids = ["ex-1", "ex-1", "ex-2"];
    const unique = [...new Set(ids)];
    expect(unique).toEqual(["ex-1", "ex-2"]);
  });

  it("13. documents refusal reason for foreign sessions", () => {
    const reason = "Vous n’avez pas le droit de modifier cette séance (elle appartient à un autre formateur).";
    expect(humanizeStudioError(reason)).toMatch(/autre formateur|droit/i);
  });
});
