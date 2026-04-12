import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface SessionClosureReminderProps {
  currentSessionId: string;
  groupId: string;
  currentSessionDate: string;
}

/**
 * Shows a prominent reminder if the previous session for this group
 * was never closed (still planifiee or en_cours past its end time).
 */
const SessionClosureReminder: React.FC<SessionClosureReminderProps> = ({
  currentSessionId,
  groupId,
  currentSessionDate,
}) => {
  const navigate = useNavigate();

  const { data: unclosedSession, refetch } = useQuery({
    queryKey: ["unclosed-prev-session", groupId, currentSessionId],
    queryFn: async () => {
      // Find previous sessions that are NOT terminee/annulee
      const { data } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, duree_minutes, statut")
        .eq("group_id", groupId)
        .lt("date_seance", currentSessionDate)
        .in("statut", ["planifiee", "en_cours"])
        .order("date_seance", { ascending: false })
        .limit(1);

      if (!data || data.length === 0) return null;

      const prev = data[0];
      const endTime = new Date(prev.date_seance);
      endTime.setMinutes(endTime.getMinutes() + (prev.duree_minutes || 90));

      // Only remind if the session end time has passed
      if (endTime > new Date()) return null;

      return prev;
    },
    enabled: !!groupId && !!currentSessionDate,
  });

  if (!unclosedSession) return null;

  const handleCloseNow = async () => {
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ statut: "terminee" as any, updated_at: new Date().toISOString() })
        .eq("id", unclosedSession.id);
      if (error) throw error;
      toast.success(`Séance « ${unclosedSession.titre} » clôturée.`);
      refetch();
    } catch (e: any) {
      toast.error("Erreur lors de la clôture", { description: e.message });
    }
  };

  const handleGoToPilot = () => {
    navigate(`/formateur/seances/${unclosedSession.id}/pilot`);
  };

  const isEnCours = unclosedSession.statut === "en_cours";

  return (
    <Alert variant="destructive" className="border-2 border-destructive/50 bg-destructive/5 print:hidden">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="text-base font-semibold">
        ⚠️ Séance précédente non clôturée
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>
          La séance <strong>« {unclosedSession.titre} »</strong> du{" "}
          {new Date(unclosedSession.date_seance).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
          })}{" "}
          est toujours{" "}
          <strong>{isEnCours ? "en cours" : "planifiée"}</strong>.
          Veuillez la clôturer pour que les données soient correctement prises en compte.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="destructive"
            onClick={handleGoToPilot}
            className="gap-1"
          >
            <Clock className="h-4 w-4" />
            Ouvrir le cockpit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCloseNow}
            className="gap-1"
          >
            <CheckCircle2 className="h-4 w-4" />
            Clôturer maintenant
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default SessionClosureReminder;
