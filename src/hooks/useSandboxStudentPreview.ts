import { useCallback } from "react";
import { toast } from "sonner";
import type { SandboxLevel } from "@/contexts/SandboxContext";
import { useSandbox } from "@/contexts/SandboxContext";
import { useSandboxPreview } from "@/contexts/SandboxPreviewContext";

function sessionNeedsReactivation(
  session: { statut: string; expires_at: string } | null | undefined,
): boolean {
  if (!session) return true;
  if (session.statut !== "active") return true;
  return new Date(session.expires_at).getTime() <= Date.now();
}

/** Basculer élève : réactive la sandbox si expirée, puis ouvre l'aperçu iframe. */
export function useSandboxStudentPreview() {
  const { session, setup } = useSandbox();
  const { enterStudentPreview } = useSandboxPreview();

  const switchToStudentPreview = useCallback(
    async (niveau: SandboxLevel) => {
      try {
        if (sessionNeedsReactivation(session)) {
          await setup(false);
        }
        enterStudentPreview(niveau);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Impossible d'ouvrir l'aperçu élève sandbox",
        );
      }
    },
    [enterStudentPreview, session, setup],
  );

  return { switchToStudentPreview };
}
