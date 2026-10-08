import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { REPEATED_DIFFICULTY_RULE } from "@/lib/formateur/pedagogicalAlertCycle";
import {
  classifyPedagogicalAlert,
  confirmPedagogicalAlert,
  listPedagogicalAlerts,
  PedagogicalAlertsAccessError,
  recordPedagogicalAlert,
  type PedagogicalAlertDraft,
  type PedagogicalAlertsClient,
} from "@/lib/formateur/pedagogicalAlertsApi";

type Props = {
  client: PedagogicalAlertsClient;
  formateurId: string;
  drafts: PedagogicalAlertDraft[];
  onCompute: () => void;
};

function errorText(error: unknown) {
  if (error instanceof PedagogicalAlertsAccessError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Lecture des alertes enregistrées impossible.";
}

export default function PersistedPedagogicalAlerts({ client, formateurId, drafts, onCompute }: Props) {
  const queryClient = useQueryClient();
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [duplicateNote, setDuplicateNote] = useState<string | null>(null);
  const queryKey = ["pedagogical-alerts", formateurId];

  const alertsQuery = useQuery({
    queryKey,
    enabled: !!formateurId,
    retry: false,
    queryFn: () => listPedagogicalAlerts(client, formateurId),
  });

  const reload = () => queryClient.invalidateQueries({ queryKey });

  const confirm = useMutation({
    mutationFn: (alertId: string) => confirmPedagogicalAlert(client, alertId),
    onSuccess: () => {
      setActionError(null);
      return reload();
    },
    onError: (error) => setActionError(errorText(error)),
  });

  const classify = useMutation({
    mutationFn: ({ alertId, motif }: { alertId: string; motif: string }) =>
      classifyPedagogicalAlert(client, alertId, motif),
    onSuccess: () => {
      setActionError(null);
      return reload();
    },
    onError: (error) => setActionError(errorText(error)),
  });

  const record = useMutation({
    mutationFn: (draft: PedagogicalAlertDraft) => recordPedagogicalAlert(client, formateurId, draft),
    onSuccess: async (outcome) => {
      setActionError(null);
      setDuplicateNote(outcome === "duplicate" ? "Alerte déjà enregistrée. La liste a été rechargée." : null);
      await reload();
    },
    onError: (error) => {
      setDuplicateNote(null);
      setActionError(errorText(error));
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Alertes enregistrées</h2>
        {!formateurId ? <p className="text-sm text-muted-foreground">Session formateur absente.</p> : null}
        {alertsQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
        {alertsQuery.isLoading ? <p className="text-sm text-muted-foreground">Chargement des alertes enregistrées…</p> : null}
        {alertsQuery.isError ? (
          <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md p-2">
            {errorText(alertsQuery.error)}
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md p-2">
            {actionError}
          </p>
        ) : null}
        {duplicateNote ? <p className="text-sm text-muted-foreground">{duplicateNote}</p> : null}
        {alertsQuery.isSuccess && alertsQuery.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune alerte enregistrée.</p>
        ) : null}
        {alertsQuery.isSuccess
          ? alertsQuery.data.map((alert) => (
              <Card key={alert.id}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex gap-2 items-center">
                    {alert.sous_competence}
                    <Badge variant="outline">{alert.status}</Badge>
                  </CardTitle>
                  <CardDescription>{alert.evidence.reason ?? alert.eleve_id}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 items-center">
                  {alert.status === "nouveau" ? (
                    <Button size="sm" variant="outline" onClick={() => confirm.mutate(alert.id)}>
                      Confirmer
                    </Button>
                  ) : null}
                  {alert.status === "confirme" ? (
                    <>
                      <Input
                        className="max-w-xs h-8 text-sm"
                        placeholder="Motif de classement"
                        aria-label={`Motif de classement ${alert.sous_competence}`}
                        value={motifs[alert.id] ?? ""}
                        onChange={(event) => setMotifs((current) => ({ ...current, [alert.id]: event.target.value }))}
                      />
                      <Button
                        size="sm"
                        disabled={!motifs[alert.id]?.trim() || classify.isPending}
                        onClick={() => classify.mutate({ alertId: alert.id, motif: motifs[alert.id] ?? "" })}
                      >
                        Classer
                      </Button>
                    </>
                  ) : null}
                  {alert.status === "classe" ? (
                    <span className="text-xs text-muted-foreground">Motif : {alert.motif_classement}</span>
                  ) : null}
                </CardContent>
              </Card>
            ))
          : null}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Propositions non enregistrées</h2>
        <p className="text-xs text-muted-foreground">
          Ce calcul reste local tant que l’enregistrement n’a pas abouti. Il ne remplace pas les alertes en base.
          Règle : {REPEATED_DIFFICULTY_RULE.minFailures} échecs ou {REPEATED_DIFFICULTY_RULE.minMaxHelpUses} aides
          niveau {REPEATED_DIFFICULTY_RULE.maxHelpLevel} / {REPEATED_DIFFICULTY_RULE.windowDays} j.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onCompute}>
          Calculer les alertes
        </Button>
        {drafts.map((draft) => (
          <Card key={`${draft.eleveId}-${draft.sousCompetence}-${draft.ruleId}`}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">{draft.sousCompetence}</CardTitle>
              <CardDescription>{draft.reason} · non enregistrée</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" disabled={!formateurId || record.isPending} onClick={() => record.mutate(draft)}>
                Enregistrer
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
