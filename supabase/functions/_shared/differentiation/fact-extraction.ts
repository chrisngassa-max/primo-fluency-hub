import type { DifferentiationFact } from "./types.ts";

export const FACT_EXTRACTION_PROMPT_HEADER = `Extrait seulement des faits réellement entendus dans cette transcription audio.

Règles:
- N'invente aucun fait, aucune inférence non supportée, aucune connaissance extérieure.
- Conserve les opinions, arguments, intentions, attitudes, points de vue rapportés, causes, conséquences et implicites réellement étayés par une citation.
- Ne réduis pas une opinion ou un argument à explicit_info.
- justified=true uniquement pour une opinion, un argument, une attitude ou une intention dont la justification est entendue. Interdit de mettre justified=true sur tous les faits explicites.
- Si justified=true, renseigne support_fact_ids (et supporting_fact_refs) avec les fact_id des faits justificatifs extraits ici.
- Distingue epistemic: fact | opinion | hypothesis.
- speaker: acteur identifiable (nom ou rôle entendu). Interdit: narrateur, locuteur, speaker, unknown.
- viewpoint: l'acteur dont la position est rapportée, y compris dans un monologue (ex. Laure vs ses grands-parents vs ses parents).
- modality: assertion | opinion | hypothese | rapporte, seulement si entendue.
- relation_type: justification | opposition | consequence | cause | contrast | comparison | none.
- chunk_refs et segment_refs: uniquement des UUID présents dans le contexte.
- quote: passage verbatim court qui prouve le fait.

JSON {"facts":[{"fact_id":"fact_01","subject":"...","predicate":"...","object":"...","semantic_qualifiers":{"fact_kind":"explicit_info|main_idea|chronology|cause|consequence|opinion|intention|viewpoint|argument|implicature|hypothesis|attitude|fact","speaker":"...","viewpoint":"...","justified":false,"support_fact_ids":[],"supporting_fact_refs":[],"epistemic":"fact|opinion|hypothesis","modality":"assertion|opinion|hypothese|rapporte","relation_type":"justification|opposition|consequence|cause|contrast|comparison|none"},"chunk_refs":["uuid"],"segment_refs":["uuid"],"quote":"...","required_for_task":true}]}`;

export interface RawExtractedFact {
  fact_id?: unknown;
  subject?: unknown;
  predicate?: unknown;
  object?: unknown;
  semantic_qualifiers?: unknown;
  chunk_refs?: unknown;
  segment_refs?: unknown;
  quote?: unknown;
  required_for_task?: unknown;
}

export interface FactExtractionContext {
  sourceId: string;
  transcriptionId: string;
  validSegmentIds: Set<string>;
  validChunkIds: Set<string>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function remapIdList(value: unknown, idMap: Map<string, string>): string[] {
  const remapped: string[] = [];
  for (const item of asStringArray(value)) {
    const next = idMap.get(item);
    if (next && !remapped.includes(next)) remapped.push(next);
  }
  return remapped;
}

export function remapQualifierRefs(
  qualifiers: Record<string, unknown>,
  idMap: Map<string, string>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...qualifiers };
  const supportFactIds = remapIdList(qualifiers.support_fact_ids, idMap);
  const supportingFactRefs = remapIdList(qualifiers.supporting_fact_refs, idMap);
  if (supportFactIds.length > 0) next.support_fact_ids = supportFactIds;
  else delete next.support_fact_ids;
  if (supportingFactRefs.length > 0) next.supporting_fact_refs = supportingFactRefs;
  else if (supportFactIds.length > 0) next.supporting_fact_refs = supportFactIds;
  else delete next.supporting_fact_refs;
  return next;
}

function hasValidProvenance(
  fact: RawExtractedFact,
  ctx: FactExtractionContext,
): boolean {
  const quote = String(fact.quote ?? "").trim();
  const segmentRefs = asStringArray(fact.segment_refs);
  const chunkRefs = asStringArray(fact.chunk_refs);
  return quote.length > 0
    && segmentRefs.length > 0
    && segmentRefs.every((id) => ctx.validSegmentIds.has(id))
    && chunkRefs.length > 0
    && chunkRefs.every((id) => ctx.validChunkIds.has(id));
}

/**
 * Filtre les faits sans provenance, réattribue des fact_id stables,
 * et recrable support_fact_ids / supporting_fact_refs vers les ids conservés.
 */
export function normalizeExtractedFacts(
  rawFacts: unknown,
  ctx: FactExtractionContext,
): DifferentiationFact[] {
  const incoming = Array.isArray(rawFacts) ? rawFacts as RawExtractedFact[] : [];
  const kept = incoming.filter((fact) => hasValidProvenance(fact, ctx));
  const idMap = new Map<string, string>();
  kept.forEach((fact, index) => {
    const nextId = `fact_${String(index + 1).padStart(2, "0")}`;
    const original = typeof fact.fact_id === "string" ? fact.fact_id.trim() : "";
    if (original) idMap.set(original, nextId);
  });

  return kept.map((fact, index) => {
    const factId = `fact_${String(index + 1).padStart(2, "0")}`;
    const qualifiers = fact.semantic_qualifiers && typeof fact.semantic_qualifiers === "object"
      && !Array.isArray(fact.semantic_qualifiers)
      ? remapQualifierRefs(fact.semantic_qualifiers as Record<string, unknown>, idMap)
      : {};
    return {
      fact_id: factId,
      subject: String(fact.subject ?? ""),
      predicate: String(fact.predicate ?? ""),
      object: fact.object ?? "",
      semantic_qualifiers: qualifiers,
      provenance: {
        source_id: ctx.sourceId,
        transcription_id: ctx.transcriptionId,
        segment_refs: asStringArray(fact.segment_refs),
        chunk_refs: asStringArray(fact.chunk_refs),
        quote: String(fact.quote ?? "").trim(),
      },
      required_for_task: fact.required_for_task !== false,
    };
  });
}
