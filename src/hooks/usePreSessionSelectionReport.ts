import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchPreSessionBankCandidates } from "@/lib/pre-session-selection-data";
import {
  preSessionSelectExercises,
  type PreSessionSelectionParams,
  type PreSessionSelectionReport,
} from "@/lib/pre-session-selection";

export interface UsePreSessionSelectionReportOptions {
  selectionParams: PreSessionSelectionParams;
  groupId?: string | null;
  enabled?: boolean;
}

async function fetchGroupEleveIds(groupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("eleve_id")
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.eleve_id).filter(Boolean);
}

export function usePreSessionSelectionReport({
  selectionParams,
  groupId,
  enabled = true,
}: UsePreSessionSelectionReportOptions) {
  const eleveIdsQuery = useQuery({
    queryKey: ["pre-session-group-eleves", groupId],
    queryFn: () => fetchGroupEleveIds(groupId!),
    enabled: enabled && !!groupId,
    staleTime: 60_000,
  });

  const bankQuery = useQuery({
    queryKey: ["pre-session-bank-candidates", groupId ?? "no-group", eleveIdsQuery.data],
    queryFn: () =>
      fetchPreSessionBankCandidates(supabase, {
        eleveIds: eleveIdsQuery.data ?? [],
      }),
    enabled: enabled && (eleveIdsQuery.isSuccess || !groupId),
    staleTime: 5 * 60_000,
  });

  const report = useMemo<PreSessionSelectionReport | null>(() => {
    if (!bankQuery.data) return null;
    return preSessionSelectExercises(bankQuery.data, selectionParams);
  }, [bankQuery.data, selectionParams]);

  const isLoading = eleveIdsQuery.isLoading || bankQuery.isLoading;
  const error =
    eleveIdsQuery.error instanceof Error
      ? eleveIdsQuery.error.message
      : bankQuery.error instanceof Error
        ? bankQuery.error.message
        : eleveIdsQuery.error || bankQuery.error
          ? "Erreur lors du chargement du rapport pré-séance"
          : null;

  return {
    report,
    candidates: bankQuery.data ?? [],
    isLoading,
    error,
    bankCount: bankQuery.data?.length ?? 0,
  };
}
