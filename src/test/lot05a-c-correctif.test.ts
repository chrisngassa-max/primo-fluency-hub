import { describe, expect, it } from "vitest";
import {
  applyVariantItemCap,
  resolveCorrectifMode,
  sealSharedFacts,
  selectReusableFacts,
  stampSharedFactsOnLevels,
} from "../../supabase/functions/_shared/differentiation/lot05a-c.ts";
import type { DifferentiationFact } from "../../supabase/functions/_shared/differentiation/types.ts";
import { SLICE_LEVELS } from "../../supabase/functions/_shared/differentiation/types.ts";
import {
  linkPublishedExerciseToSession,
  unlinkPublishedExerciseFromSession,
} from "../../supabase/functions/_shared/session-exercice-link.ts";

const facts: DifferentiationFact[] = [
  {
    fact_id: "fact_01",
    subject: "Louise",
    predicate: "habite",
    object: "en ville",
    semantic_qualifiers: { fact_kind: "lieu" },
    required_for_task: true,
    provenance: {
      source_id: "source-louise",
      transcription_id: "tr-1",
      segment_refs: ["seg-1"],
      chunk_refs: ["chunk-1"],
      quote: "j'habite en ville",
    },
  },
  {
    fact_id: "fact_02",
    subject: "Louise",
    predicate: "écoute",
    object: "de la musique",
    semantic_qualifiers: { fact_kind: "action" },
    required_for_task: true,
    provenance: {
      source_id: "source-louise",
      transcription_id: "tr-1",
      segment_refs: ["seg-2"],
      chunk_refs: ["chunk-1"],
      quote: "j'écoute de la musique",
    },
  },
];

const linkInput = {
  sourceId: "source-louise",
  facts,
  sessionId: "session-curriculum-1",
  exerciceId: "exercice-a2",
};

describe("Lot 5A-C faits partagés", () => {
  it("scelle un seul facts_hash pour A1, A2, B1 et B2", async () => {
    const sealed = await sealSharedFacts({ sourceId: "source-louise", facts });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const stamped = stampSharedFactsOnLevels(sealed.facts, sealed.facts_hash);
    const hashes = SLICE_LEVELS.map((level) => stamped[level].facts_hash);
    expect(new Set(hashes).size).toBe(1);
    expect(hashes[0]).toBe(sealed.facts_hash);
    for (const level of SLICE_LEVELS) {
      expect(stamped[level].facts).toBe(facts);
    }
  });

  it("réutilise l'ensemble déjà stocké sans second hash", async () => {
    const sealed = await sealSharedFacts({ sourceId: "source-louise", facts });
    if (!sealed.ok) throw new Error(sealed.error);
    const reusable = selectReusableFacts([
      { facts: { required: sealed.facts, facts_hash: sealed.facts_hash } },
      { facts: { required: sealed.facts, facts_hash: sealed.facts_hash } },
    ]);
    expect(reusable.status).toBe("reuse");
    if (reusable.status !== "reuse") return;
    expect(reusable.facts_hash).toBe(sealed.facts_hash);
    expect(reusable.facts).toBe(sealed.facts);
  });

  it("échoue si la source ou les faits manquent, et si les hash divergent", async () => {
    expect((await sealSharedFacts({ sourceId: "  ", facts })).ok).toBe(false);
    expect((await sealSharedFacts({ sourceId: "", facts }))).toMatchObject({ error: "SOURCE_REQUIRED" });
    expect((await sealSharedFacts({ sourceId: "source-louise", facts: [] }))).toMatchObject({ error: "FACTS_REQUIRED" });
    const first = await sealSharedFacts({ sourceId: "source-louise", facts });
    const second = await sealSharedFacts({ sourceId: "source-louise", facts: [facts[0]] });
    if (!first.ok || !second.ok) throw new Error("fixtures");
    const diverged = selectReusableFacts([
      { facts: { required: first.facts, facts_hash: first.facts_hash } },
      { facts: { required: second.facts, facts_hash: second.facts_hash } },
    ]);
    expect(diverged.status).toBe("diverged");
  });
});

describe("Lot 5A-C plafond de six items", () => {
  it("refuse une variante de sept items et conserve le plafond du contrat en retour arrière", () => {
    const seven = Array.from({ length: 7 }, (_, index) => ({ id: `item_${index}` }));
    const blocked = applyVariantItemCap(seven, resolveCorrectifMode(true));
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toBe("VARIANT_ITEM_CAP_EXCEEDED");
      expect(blocked.max).toBe(6);
    }
    const rollback = applyVariantItemCap(seven, resolveCorrectifMode(false));
    expect(rollback.ok).toBe(true);
    if (rollback.ok) expect(rollback.items).toHaveLength(7);
    const six = applyVariantItemCap(seven.slice(0, 6), "lot05a_c");
    expect(six.ok).toBe(true);
    if (six.ok) expect(six.items).toHaveLength(6);
  });
});

describe("Lot 5A-C liaison séance curriculum", () => {
  it("rattache puis retire un exercice publié", () => {
    const linked = linkPublishedExerciseToSession([], linkInput);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.links).toEqual([{
      session_id: "session-curriculum-1",
      exercice_id: "exercice-a2",
      ordre: 1,
      statut: "planifie",
      bloc: "curriculum",
      eleve_id: null,
    }]);
    const removed = unlinkPublishedExerciseFromSession(linked.links, linkInput);
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.links).toEqual([]);
  });

  it("échoue proprement si la source, les faits ou la séance manquent", () => {
    expect(linkPublishedExerciseToSession([], { ...linkInput, sourceId: "" })).toMatchObject({ error: "SOURCE_REQUIRED" });
    expect(linkPublishedExerciseToSession([], { ...linkInput, facts: [] })).toMatchObject({ error: "FACTS_REQUIRED" });
    expect(linkPublishedExerciseToSession([], { ...linkInput, sessionId: " " })).toMatchObject({ error: "SESSION_REQUIRED" });
    expect(unlinkPublishedExerciseFromSession([], linkInput)).toMatchObject({ error: "LINK_NOT_FOUND" });
  });
});
