import { describe, expect, it } from "vitest";
import { normalizeExtractedFacts } from "../../supabase/functions/_shared/differentiation/fact-extraction.ts";

const ctx = {
  sourceId: "source-1",
  transcriptionId: "tr-1",
  validSegmentIds: new Set(["seg-1", "seg-2"]),
  validChunkIds: new Set(["chunk-1", "chunk-2"]),
};

describe("normalizeExtractedFacts", () => {
  it("drops facts without quote or valid chunk/segment refs", () => {
    const facts = normalizeExtractedFacts([
      {
        fact_id: "keep",
        subject: "Laure",
        predicate: "dit",
        object: "elle a de la chance",
        semantic_qualifiers: { fact_kind: "opinion" },
        chunk_refs: ["chunk-1"],
        segment_refs: ["seg-1"],
        quote: "j'ai beaucoup de chance",
      },
      {
        fact_id: "no-quote",
        chunk_refs: ["chunk-1"],
        segment_refs: ["seg-1"],
        quote: "  ",
      },
      {
        fact_id: "bad-chunk",
        chunk_refs: ["missing"],
        segment_refs: ["seg-1"],
        quote: "citation",
      },
    ], ctx);

    expect(facts).toHaveLength(1);
    expect(facts[0].fact_id).toBe("fact_01");
    expect(facts[0].provenance.quote).toBe("j'ai beaucoup de chance");
  });

  it("remaps support_fact_ids after dropping invalid facts", () => {
    const facts = normalizeExtractedFacts([
      {
        fact_id: "raw_a",
        subject: "Laure",
        predicate: "considère",
        object: "avoir de la chance",
        semantic_qualifiers: {
          fact_kind: "opinion",
          justified: true,
          support_fact_ids: ["raw_b", "raw_dropped"],
          supporting_fact_refs: ["raw_b"],
          modality: "opinion",
          relation_type: "justification",
        },
        chunk_refs: ["chunk-1"],
        segment_refs: ["seg-1"],
        quote: "j'ai beaucoup de chance parce que",
      },
      {
        fact_id: "raw_dropped",
        quote: "",
        chunk_refs: ["chunk-1"],
        segment_refs: ["seg-1"],
      },
      {
        fact_id: "raw_b",
        subject: "grands-parents",
        predicate: "ont vécu",
        object: "la guerre",
        semantic_qualifiers: { fact_kind: "cause", speaker: "Laure" },
        chunk_refs: ["chunk-2"],
        segment_refs: ["seg-2"],
        quote: "eux ont pu le vivre la Seconde Guerre mondiale",
      },
    ], ctx);

    expect(facts.map((fact) => fact.fact_id)).toEqual(["fact_01", "fact_02"]);
    expect(facts[0].semantic_qualifiers.support_fact_ids).toEqual(["fact_02"]);
    expect(facts[0].semantic_qualifiers.supporting_fact_refs).toEqual(["fact_02"]);
    expect(facts[0].semantic_qualifiers.modality).toBe("opinion");
    expect(facts[0].semantic_qualifiers.relation_type).toBe("justification");
    expect(facts[1].semantic_qualifiers.speaker).toBe("Laure");
  });

  it("drops support links that point to a deleted or unknown fact", () => {
    const facts = normalizeExtractedFacts([
      {
        fact_id: "raw_opinion",
        subject: "Laure",
        predicate: "dit",
        object: "une opinion",
        semantic_qualifiers: {
          fact_kind: "opinion",
          justified: true,
          support_fact_ids: ["raw_missing", "does-not-exist"],
          supporting_fact_refs: ["raw_missing"],
        },
        chunk_refs: ["chunk-1"],
        segment_refs: ["seg-1"],
        quote: "à mon avis",
      },
    ], ctx);

    expect(facts).toHaveLength(1);
    expect(facts[0].semantic_qualifiers.support_fact_ids).toBeUndefined();
    expect(facts[0].semantic_qualifiers.supporting_fact_refs).toBeUndefined();
  });
});
