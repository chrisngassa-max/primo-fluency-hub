import { calculateFactsHash } from "./fact-hashing.ts";
import type { DifferentiationFact, SliceLevel } from "./types.ts";
import { SLICE_LEVELS } from "./types.ts";

export const LOT_05A_C_MAX_ITEMS = 6;
export type CorrectifMode = "rollback" | "lot05a_c";

export function resolveCorrectifMode(enabled: unknown): CorrectifMode {
  return enabled === true ? "lot05a_c" : "rollback";
}

export type SharedFactsResult =
  | { ok: true; sourceId: string; facts: DifferentiationFact[]; facts_hash: string }
  | { ok: false; error: "SOURCE_REQUIRED" | "FACTS_REQUIRED" };

export async function sealSharedFacts(input: {
  sourceId?: string | null;
  facts?: DifferentiationFact[] | null;
}): Promise<SharedFactsResult> {
  const sourceId = input.sourceId?.trim() ?? "";
  if (!sourceId) return { ok: false, error: "SOURCE_REQUIRED" };
  if (!input.facts?.length) return { ok: false, error: "FACTS_REQUIRED" };
  const facts_hash = await calculateFactsHash(input.facts);
  return { ok: true, sourceId, facts: input.facts, facts_hash };
}

export function stampSharedFactsOnLevels(
  facts: DifferentiationFact[],
  factsHash: string,
): Record<SliceLevel, { facts: DifferentiationFact[]; facts_hash: string }> {
  const stamped = {} as Record<SliceLevel, { facts: DifferentiationFact[]; facts_hash: string }>;
  for (const level of SLICE_LEVELS) {
    stamped[level] = { facts, facts_hash: factsHash };
  }
  return stamped;
}

type StoredFactSet = { facts: DifferentiationFact[]; facts_hash: string };

function readStoredFactSet(payload: unknown): StoredFactSet | null {
  if (!payload || typeof payload !== "object") return null;
  const facts = (payload as { facts?: { required?: DifferentiationFact[]; facts_hash?: string } }).facts;
  if (!facts?.required?.length || typeof facts.facts_hash !== "string" || !facts.facts_hash) return null;
  return { facts: facts.required, facts_hash: facts.facts_hash };
}

export type ReusableFacts =
  | { status: "reuse"; facts: DifferentiationFact[]; facts_hash: string }
  | { status: "extract_once" }
  | { status: "diverged"; hashes: string[] };

/** Réutilise le premier ensemble déjà scellé. N'extrait rien et n'appelle aucun modèle. */
export function selectReusableFacts(payloads: unknown[]): ReusableFacts {
  const hashes = new Set<string>();
  let selected: StoredFactSet | null = null;
  for (const payload of payloads) {
    const stored = readStoredFactSet(payload);
    if (!stored) continue;
    hashes.add(stored.facts_hash);
    if (!selected) selected = stored;
  }
  if (!selected) return { status: "extract_once" };
  if (hashes.size > 1) return { status: "diverged", hashes: [...hashes] };
  return { status: "reuse", facts: selected.facts, facts_hash: selected.facts_hash };
}

export type ItemCapResult<T> =
  | { ok: true; items: T[] }
  | { ok: false; error: "VARIANT_ITEM_CAP_EXCEEDED"; count: number; max: number };

export function applyVariantItemCap<T>(items: T[], mode: CorrectifMode): ItemCapResult<T> {
  if (mode === "rollback") return { ok: true, items };
  if (items.length > LOT_05A_C_MAX_ITEMS) {
    return { ok: false, error: "VARIANT_ITEM_CAP_EXCEEDED", count: items.length, max: LOT_05A_C_MAX_ITEMS };
  }
  return { ok: true, items };
}

export function assertPublishedVariantItemCap(
  payload: unknown,
  enabled: boolean,
): ItemCapResult<unknown> {
  if (!enabled) {
    const items = readVariantItems(payload);
    return { ok: true, items };
  }
  return applyVariantItemCap(readVariantItems(payload), "lot05a_c");
}

function readVariantItems(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as {
    generated_levels?: string[];
    variants?: Record<string, { exercise?: { items?: unknown[] } }>;
  };
  const level = body.generated_levels?.[0];
  const variant = (level && body.variants?.[level]) || Object.values(body.variants ?? {})[0];
  return Array.isArray(variant?.exercise?.items) ? variant.exercise.items : [];
}
