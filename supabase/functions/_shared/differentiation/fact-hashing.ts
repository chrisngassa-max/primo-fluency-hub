import { canonicalJson } from "./canonical-json.ts";
import type { DifferentiationFact } from "./types.ts";

function semanticProjection(fact: DifferentiationFact): Record<string, unknown> {
  return {
    fact_id: fact.fact_id,
    subject: fact.subject,
    predicate: fact.predicate,
    object: fact.object,
    semantic_qualifiers: fact.semantic_qualifiers,
    required_for_task: fact.required_for_task,
  };
}

export function canonicalFactsPayload(facts: DifferentiationFact[]): string {
  return canonicalJson(
    [...facts]
      .sort((left, right) => left.fact_id.localeCompare(right.fact_id))
      .map(semanticProjection),
  );
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

export async function calculateFactsHash(facts: DifferentiationFact[]): Promise<string> {
  return sha256(canonicalFactsPayload(facts));
}
