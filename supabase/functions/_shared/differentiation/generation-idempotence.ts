/**
 * Helpers purs pour l'idempotence generate-differentiation-family.
 * Testables hors Deno.serve.
 */

export type IdempotenceFamilyRow = {
  id: string;
  generation_status: string;
  review_status: string;
  published_exercise_id?: string | null;
  payload?: unknown;
};

/**
 * L'index unique d'idempotence inclut referential_version.
 * Une génération 1.2 ne doit jamais réutiliser une famille 1.1 en cache.
 */
export function wouldReuseCachedFamily(
  storedReferentialVersion: string | null | undefined,
  currentReferentialVersion: string,
): boolean {
  return Boolean(storedReferentialVersion) && storedReferentialVersion === currentReferentialVersion;
}

export function isPostgresUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  const message = String(error.message ?? "");
  return message.includes("23505") || message.includes("idx_differentiation_families_idempotence");
}

export function resolveForceRegenerateGate(existing: IdempotenceFamilyRow | null | undefined): {
  allowed: boolean;
  error?: "FAMILY_ALREADY_PUBLISHED" | "FORCE_REGENERATE_BLOCKED_PUBLISHED";
  canArchive: boolean;
} {
  if (!existing) return { allowed: true, canArchive: false };
  if (existing.published_exercise_id || existing.review_status === "published") {
    return {
      allowed: false,
      error: "FORCE_REGENERATE_BLOCKED_PUBLISHED",
      canArchive: false,
    };
  }
  return { allowed: true, canArchive: true };
}

export function resolveIdempotentConflictResponse(existing: IdempotenceFamilyRow | null | undefined): {
  status: 200 | 409;
  body: Record<string, unknown>;
} {
  if (existing?.generation_status === "generated") {
    return {
      status: 200,
      body: {
        ok: true,
        cached: true,
        family_id: existing.id,
        payload: existing.payload,
        conflict_resolved: "unique_violation",
      },
    };
  }
  if (existing?.generation_status === "generating") {
    return {
      status: 409,
      body: {
        error: "FAMILY_GENERATION_ALREADY_RUNNING",
        family_id: existing.id,
        conflict_resolved: "unique_violation",
      },
    };
  }
  return {
    status: 409,
    body: {
      error: "FAMILY_IDEMPOTENCE_CONFLICT",
      conflict_resolved: "unique_violation",
    },
  };
}
