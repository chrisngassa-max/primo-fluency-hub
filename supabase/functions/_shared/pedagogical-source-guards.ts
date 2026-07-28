export type PedagogicalSourceLifecycleStatus = "imported" | "analyzing" | "analyzed" | "error";
export type PedagogicalSourceReviewStatus = "brouillon" | "utilisable" | "valide" | "a_remplacer";

export interface PedagogicalSourceAccessRow {
  id: string;
  created_by: string | null;
}

export interface PedagogicalSourceStateRow {
  status: PedagogicalSourceLifecycleStatus | string | null;
  review_status: PedagogicalSourceReviewStatus | string | null;
}

const READY_REVIEW_STATUSES = new Set<PedagogicalSourceReviewStatus>(["utilisable", "valide"]);

export function getPedagogicalSourceAccessError(params: {
  isStaff: boolean;
  isAdmin: boolean;
  userId: string;
  source: PedagogicalSourceAccessRow | null;
}): string | null {
  const { isStaff, isAdmin, userId, source } = params;
  if (!isStaff && !isAdmin) return "STAFF_ROLE_REQUIRED";
  if (!source) return "SOURCE_NOT_FOUND";
  if (!isAdmin && source.created_by !== userId) return "SOURCE_FORBIDDEN";
  return null;
}

export function isPedagogicalSourceReadyForDifferentiation(source: PedagogicalSourceStateRow): boolean {
  return source.status === "analyzed" && READY_REVIEW_STATUSES.has(source.review_status as PedagogicalSourceReviewStatus);
}

export function getPedagogicalSourceReadinessError(source: PedagogicalSourceStateRow): string | null {
  if (source.status !== "analyzed") return "SOURCE_NOT_ANALYZED";
  if (!READY_REVIEW_STATUSES.has(source.review_status as PedagogicalSourceReviewStatus)) {
    return "SOURCE_REVIEW_NOT_APPROVED";
  }
  return null;
}
