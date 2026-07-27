import { supabase as _supabase } from "@/integrations/supabase/client";

const supabase = _supabase as any;

export type DifferentiationFamily = {
  id: string;
  family_id: string;
  generation_status: "queued" | "generating" | "generated" | "failed";
  validation_status: "pending" | "passed" | "passed_with_warnings" | "failed";
  review_status: "draft" | "in_review" | "validated" | "rejected" | "published" | "archived";
  validation_report: {
    status?: string;
    blocking?: Array<{ code?: string; message?: string }>;
    warnings?: Array<{ code?: string; message?: string }>;
    requires_human_review?: string[];
  };
  payload: any;
  published_exercise_id: string | null;
  generation_error: { message?: string } | null;
};

export async function fetchLatestDifferentiationFamily(sourceId: string): Promise<DifferentiationFamily | null> {
  const { data, error } = await supabase
    .from("differentiation_families")
    .select("id, family_id, generation_status, validation_status, review_status, validation_report, payload, published_exercise_id, generation_error")
    .eq("source_id", sourceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as DifferentiationFamily | null;
}

export async function generateDifferentiationFamily(sourceId: string, forceRegenerate = false) {
  const { data, error } = await supabase.functions.invoke("generate-differentiation-family", {
    body: { sourceId, force_regenerate: forceRegenerate },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function updateDifferentiationFamilyReview(
  familyId: string,
  reviewStatus: "in_review" | "validated" | "rejected",
) {
  const { error } = await supabase
    .from("differentiation_families")
    .update({ review_status: reviewStatus })
    .eq("id", familyId);
  if (error) throw error;
}

export async function addDifferentiationFamilyFeedback(
  familyId: string,
  userId: string,
  comment: string,
  targetType = "family",
  targetId?: string,
) {
  const { error } = await supabase.from("differentiation_family_feedback").insert({
    family_id: familyId,
    target_type: targetType,
    target_id: targetId,
    issue_type: "other",
    comment: comment.trim(),
    created_by: userId,
  });
  if (error) throw error;
}

export async function publishDifferentiationFamily(familyId: string) {
  const { data, error } = await supabase.functions.invoke("publish-differentiation-family", { body: { familyId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { exercise_id: string };
}
