/** Pure helpers for curriculum-adapt (testable without Deno runtime). */

export interface CurriculumResourceRow {
  id: string;
  session_id: string;
  resource_id: string;
  kind: string;
  version: number;
  chemin: string | null;
  statut: string;
  support_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ExerciseVariantRow {
  id: string;
  support_id: string;
  niveau: string;
  version: number;
  statut: string;
  consigne?: string;
}

export interface PublishedResourceSummary {
  id: string;
  resource_id: string;
  kind: string;
}

const PUBLISHED = "published";

export function filterPublishedResources(resources: CurriculumResourceRow[]): CurriculumResourceRow[] {
  return resources.filter((r) => r.statut === PUBLISHED);
}

/** Keep the highest version per resource_id for published rows. */
export function pickLatestPublishedResources(resources: CurriculumResourceRow[]): CurriculumResourceRow[] {
  const byResourceId = new Map<string, CurriculumResourceRow>();
  for (const row of filterPublishedResources(resources)) {
    const existing = byResourceId.get(row.resource_id);
    if (!existing || row.version > existing.version) {
      byResourceId.set(row.resource_id, row);
    }
  }
  return Array.from(byResourceId.values());
}

export function toPublishedSummaries(resources: CurriculumResourceRow[]): PublishedResourceSummary[] {
  return pickLatestPublishedResources(resources).map((r) => ({
    id: r.id,
    resource_id: r.resource_id,
    kind: r.kind,
  }));
}

export function resolvePublishedResourceIds(
  requestedIds: string[],
  published: CurriculumResourceRow[],
): string[] {
  const latest = pickLatestPublishedResources(published);
  const byResourceId = new Map(latest.map((r) => [r.resource_id, r.resource_id]));
  const byKind = new Map(latest.map((r) => [r.kind, r.resource_id]));
  const byId = new Map(latest.map((r) => [r.id, r.resource_id]));

  const resolved = new Set<string>();
  for (const raw of requestedIds) {
    if (byResourceId.has(raw)) resolved.add(raw);
    else if (byKind.has(raw)) resolved.add(byKind.get(raw)!);
    else if (byId.has(raw)) resolved.add(byId.get(raw)!);
  }
  return Array.from(resolved);
}

export function pickResourceByKind(
  resources: CurriculumResourceRow[],
  kind: string,
): CurriculumResourceRow | undefined {
  return pickLatestPublishedResources(resources).find((r) => r.kind === kind);
}

export function buildVariantHints(
  variantsJson: unknown,
  dbVariants: ExerciseVariantRow[],
): Record<string, string> {
  const hints: Record<string, string> = {};
  const publishedDb = dbVariants.filter((v) => v.statut === PUBLISHED);

  for (const v of publishedDb) {
    hints[v.niveau] = `variant-db:${v.id}`;
  }

  if (variantsJson && typeof variantsJson === "object" && !Array.isArray(variantsJson)) {
    for (const niveau of ["A1", "A2", "B1", "B2"]) {
      const entry = (variantsJson as Record<string, unknown>)[niveau];
      if (entry && typeof entry === "object") {
        const consigne = (entry as { consigne?: string }).consigne;
        if (!hints[niveau]) {
          hints[niveau] = consigne
            ? `variant-json:${consigne.slice(0, 80)}`
            : `variant-json:${niveau}`;
        }
      }
    }
  }

  return hints;
}

export function normalizePhaseKey(phase: string | undefined): string {
  if (!phase) return "";
  return phase
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function matchDeroulePhase(
  deroule: Array<{ phase?: string; duree_min?: number; description?: string }> | null | undefined,
  phaseKey: string,
): { phase?: string; duree_min?: number; description?: string } | undefined {
  if (!deroule?.length || !phaseKey) return undefined;
  return deroule.find((step) => normalizePhaseKey(step.phase) === phaseKey)
    ?? deroule.find((step) => normalizePhaseKey(step.phase ?? "").includes(phaseKey));
}
