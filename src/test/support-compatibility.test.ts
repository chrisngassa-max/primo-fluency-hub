import { describe, expect, it } from "vitest";
import { evaluateSupportCompatibility } from "../../supabase/functions/_shared/differentiation/support-compatibility.ts";
import type { DifferentiationFact } from "../../supabase/functions/_shared/differentiation/types.ts";

function fact(
  id: string,
  qualifiers: Record<string, unknown> = {},
  quote = "citation explicite",
): DifferentiationFact {
  return {
    fact_id: id,
    subject: "locuteur",
    predicate: "dit",
    object: quote,
    semantic_qualifiers: qualifiers,
    provenance: {
      source_id: "source-1",
      transcription_id: "tr-1",
      segment_refs: ["seg-1"],
      chunk_refs: ["chunk-1"],
      quote,
    },
    required_for_task: true,
  };
}

describe("evaluateSupportCompatibility", () => {
  it("accepts A1/A2 on simple explicit facts", () => {
    const facts = [fact("fact_01", { fact_kind: "explicit_info" })];
    expect(evaluateSupportCompatibility("A1", facts).supported).toBe(true);
    expect(evaluateSupportCompatibility("A2", facts).supported).toBe(true);
  });

  it("accepts B1 on a compatible combo", () => {
    const facts = [
      fact("fact_01", { fact_kind: "main_idea" }, "Le thème est le confinement."),
      fact("fact_02", { fact_kind: "chronology" }, "D'abord le confinement, puis la reprise."),
      fact("fact_03", { fact_kind: "opinion", speaker: "elisa" }, "Je pense que c'était difficile."),
    ];
    const result = evaluateSupportCompatibility("B1", facts);
    expect(result.supported).toBe(true);
    expect(result.code).toBe("OK");
  });

  it("accepts B2 on rich support", () => {
    const facts = [
      fact("fact_01", { fact_kind: "viewpoint", speaker: "alice", viewpoint: "alice" }, "Alice défend Paris."),
      fact("fact_02", { fact_kind: "viewpoint", speaker: "bruno", viewpoint: "bruno" }, "Bruno préfère la province."),
      fact("fact_03", { fact_kind: "argument", justified: true }, "Parce que le logement y est plus accessible."),
      fact("fact_04", { fact_kind: "opinion", justified: true }, "À mon avis, le confinement a changé nos priorités."),
      fact("fact_05", { fact_kind: "hypothesis", epistemic: "hypothesis" }, "Peut-être que le télétravail restera."),
    ];
    const result = evaluateSupportCompatibility("B2", facts);
    expect(result.supported).toBe(true);
  });

  it("refuses B2 on simple support without inventing difficulty", () => {
    const facts = [
      fact("fact_01", { fact_kind: "explicit_info" }, "Il fait du handball."),
      fact("fact_02", { fact_kind: "explicit_info" }, "Le match est samedi."),
    ];
    const result = evaluateSupportCompatibility("B2", facts);
    expect(result.supported).toBe(false);
    expect(result.code).toBe("DIFF_TRANSFORMATION_NOT_SUPPORTED");
    expect(result.message).toContain("B2");
    expect(result.message).toContain("B1");
  });

  it("refuses long purely explicit support for B2", () => {
    const facts = Array.from({ length: 12 }, (_, index) =>
      fact(
        `fact_${String(index + 1).padStart(2, "0")}`,
        { fact_kind: "explicit_info" },
        `Le locuteur cite le lieu ${index + 1}, l'heure et un prix simple sans jugement.`,
      ),
    );
    const result = evaluateSupportCompatibility("B2", facts);
    expect(result.supported).toBe(false);
    expect(result.code).toBe("DIFF_TRANSFORMATION_NOT_SUPPORTED");
    expect(result.signals.some((signal) =>
      signal.present && ["multiple_viewpoints", "argumentation", "supported_implicature", "fact_opinion_hypothesis"].includes(signal.id)
    )).toBe(false);
  });

  it("refuses B2 when LLM tags every fact epistemic=fact and viewpoint without diversity", () => {
    const facts = Array.from({ length: 8 }, (_, index) =>
      fact(
        `fact_${String(index + 1).padStart(2, "0")}`,
        {
          fact_kind: index % 2 === 0 ? "explicit_info" : "viewpoint",
          epistemic: "fact",
          speaker: "narrateur",
          viewpoint: "narrateur",
        },
        `Après le confinement, le locuteur décrit le fait ${index + 1}.`,
      ),
    );
    const result = evaluateSupportCompatibility("B2", facts);
    expect(result.supported).toBe(false);
    expect(result.code).toBe("DIFF_TRANSFORMATION_NOT_SUPPORTED");
    expect(result.signals.find((signal) => signal.id === "fact_opinion_hypothesis")?.present).toBe(false);
    expect(result.signals.find((signal) => signal.id === "multiple_viewpoints")?.present).toBe(false);
  });

  it("refuses B2 when LLM uses placeholder viewpoint=speaker on a monologue", () => {
    const facts = Array.from({ length: 6 }, (_, index) =>
      fact(
        `fact_${String(index + 1).padStart(2, "0")}`,
        {
          fact_kind: "viewpoint",
          epistemic: index === 0 ? "opinion" : "fact",
          speaker: "Laura",
          viewpoint: "speaker",
        },
        `Laura décrit l'événement ${index + 1}.`,
      ),
    );
    const result = evaluateSupportCompatibility("B2", facts);
    expect(result.supported).toBe(false);
    expect(result.code).toBe("DIFF_TRANSFORMATION_NOT_SUPPORTED");
    expect(result.signals.find((signal) => signal.id === "multiple_viewpoints")?.present).toBe(false);
  });

  it("refuses B2 on a single-speaker opinionated monologue without argumentation", () => {
    const facts = [
      fact("fact_01", { fact_kind: "explicit_info", epistemic: "fact", speaker: "Laura" }, "Laura décrit le confinement."),
      fact("fact_02", { fact_kind: "cause", epistemic: "fact", speaker: "Laura" }, "Les lieux étaient fermés."),
      fact("fact_03", { fact_kind: "opinion", epistemic: "opinion", speaker: "Laura", justified: true }, "À mon avis c'était difficile."),
      fact("fact_04", { fact_kind: "intention", epistemic: "fact", speaker: "Laura" }, "Elle veut reprendre le sport."),
      fact("fact_05", { fact_kind: "explicit_info", epistemic: "fact", speaker: "Laura" }, "Le magasin a rouvert."),
    ];
    const result = evaluateSupportCompatibility("B2", facts);
    expect(result.supported).toBe(false);
    expect(result.code).toBe("DIFF_TRANSFORMATION_NOT_SUPPORTED");
    expect(result.signals.find((signal) => signal.id === "fact_opinion_hypothesis")?.present).toBe(true);
  });

  it("refuses B2 when LLM invents thematic viewpoint tags without multiple speakers", () => {
    const facts = Array.from({ length: 6 }, (_, index) =>
      fact(
        `fact_${String(index + 1).padStart(2, "0")}`,
        {
          fact_kind: "viewpoint",
          epistemic: index === 0 ? "opinion" : "fact",
          speaker: "Laura",
          viewpoint: index % 2 === 0 ? "safety" : "societal improvement",
          justified: index === 0,
        },
        `Laura évoque le thème ${index + 1}.`,
      ),
    );
    const result = evaluateSupportCompatibility("B2", facts);
    expect(result.supported).toBe(false);
    expect(result.code).toBe("DIFF_TRANSFORMATION_NOT_SUPPORTED");
    expect(result.signals.find((signal) => signal.id === "multiple_viewpoints")?.present).toBe(false);
  });

  it("may accept shorter support with several opinions/arguments for B2", () => {
    const facts = [
      fact("fact_01", { fact_kind: "viewpoint", speaker: "a", viewpoint: "a" }, "A défend X."),
      fact("fact_02", { fact_kind: "viewpoint", speaker: "b", viewpoint: "b" }, "B défend Y."),
      fact("fact_03", { fact_kind: "argument", justified: true }, "Parce que Z."),
      fact("fact_04", { fact_kind: "opinion", justified: true }, "À mon avis W."),
      fact("fact_05", { fact_kind: "hypothesis", epistemic: "hypothesis" }, "Peut-être V."),
    ];
    expect(evaluateSupportCompatibility("B2", facts).supported).toBe(true);
  });
});
