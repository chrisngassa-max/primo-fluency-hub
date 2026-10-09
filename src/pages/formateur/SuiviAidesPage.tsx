/**
 * Lot 5 / 5C — vue formateur : devoirs, aides, autonomie.
 * Les alertes affichées comme enregistrées viennent uniquement de pedagogical_alerts.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PersistedPedagogicalAlerts from "@/components/formateur/PersistedPedagogicalAlerts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { evaluateRepeatedDifficultyAlert, REPEATED_DIFFICULTY_RULE } from "@/lib/formateur/pedagogicalAlertCycle";
import type { PedagogicalAlertDraft, PedagogicalAlertsClient } from "@/lib/formateur/pedagogicalAlertsApi";
import {
  buildAttemptOverview,
  collectDifficultyEvidence,
  exerciseAllowsUnloggedClientHint,
  presentDevoirStatus,
  type AttemptOverviewRow,
} from "@/lib/formateur/trainerHelpOverview";
import {
  PRESENTED_HINT_KIND,
  presentedHelpRowToEvent,
  type HelpLiveEvent,
} from "../../../supabase/functions/_shared/assistant-pedagogique/help-trace";

type PresentedHelpView = HelpLiveEvent & {
  created_at?: string;
  source: "seance" | "devoir";
};

function autonomyBadge(status: AttemptOverviewRow["autonomy"]) {
  if (status === "autonome") return <Badge className="bg-emerald-600">Autonome</Badge>;
  if (status === "aidee") return <Badge variant="secondary">Aidée</Badge>;
  return <Badge variant="outline">Non mesurable</Badge>;
}

export default function SuiviAidesPage() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<PedagogicalAlertDraft[]>([]);

  const { data: devoirs = [], isLoading: loadingDevoirs } = useQuery({
    queryKey: ["lot5-devoirs", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devoirs")
        .select("id, statut, eleve_id, exercice_id, session_id, created_at, eleve:profiles!devoirs_eleve_id_fkey(prenom, nom), exercice:exercices!devoirs_exercice_id_fkey(id, titre, sous_competence, contenu, formateur_id)")
        .eq("formateur_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const sessionIds = useMemo(
    () => [...new Set(devoirs.map((d) => d.session_id).filter(Boolean))] as string[],
    [devoirs],
  );
  const devoirIds = useMemo(
    () => [...new Set(devoirs.map((d) => d.id).filter(Boolean))] as string[],
    [devoirs],
  );
  const exerciseIds = useMemo(
    () => [...new Set(devoirs.map((d) => d.exercice_id).filter(Boolean))] as string[],
    [devoirs],
  );
  const learnerIds = useMemo(
    () => [...new Set(devoirs.map((d) => d.eleve_id).filter(Boolean))] as string[],
    [devoirs],
  );

  const { data: helpEvents = [] } = useQuery({
    queryKey: ["lot5-help-events", sessionIds, devoirIds],
    enabled: sessionIds.length > 0 || devoirIds.length > 0,
    queryFn: async () => {
      const presented: PresentedHelpView[] = [];

      if (sessionIds.length > 0) {
        const { data, error } = await supabase
          .from("session_live_events")
          .select("session_id, eleve_id, event_type, payload, created_at")
          .in("session_id", sessionIds)
          .eq("event_type", "aide_demandee")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        for (const row of data ?? []) {
          if ((row.payload as { kind?: string } | null)?.kind !== PRESENTED_HINT_KIND) continue;
          presented.push({
            event_type: "aide_demandee",
            session_id: row.session_id,
            eleve_id: row.eleve_id as string,
            payload: row.payload as HelpLiveEvent["payload"],
            created_at: row.created_at,
            source: "seance",
          });
        }
      }

      if (devoirIds.length > 0) {
        // Table locale migration presented_help_events — absente tant que non appliquée.
        const { data, error } = await (supabase as unknown as {
          from: (table: string) => {
            select: (columns: string) => {
              in: (column: string, values: string[]) => {
                eq: (column: string, value: string) => {
                  order: (column: string, opts: { ascending: boolean }) => {
                    limit: (n: number) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { code?: string; message?: string } | null }>;
                  };
                };
              };
            };
          };
        }).from("presented_help_events")
          .select("eleve_id,devoir_id,exercice_id,item_id,tentative_id,session_id,mode,niveau,niveau_aide,origine,contenu_version,sous_competence,presented_at,created_at")
          .in("devoir_id", devoirIds)
          .eq("kind", PRESENTED_HINT_KIND)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) {
          // 42P01 = undefined_table — migration locale pas encore appliquée.
          if (error.code !== "42P01" && !/presented_help_events|does not exist|schema cache/i.test(error.message ?? "")) {
            throw error;
          }
        } else {
          for (const row of data ?? []) {
            const event = presentedHelpRowToEvent({
              eleve_id: String(row.eleve_id),
              devoir_id: String(row.devoir_id),
              exercice_id: String(row.exercice_id),
              item_id: String(row.item_id),
              tentative_id: row.tentative_id ? String(row.tentative_id) : null,
              session_id: row.session_id ? String(row.session_id) : null,
              mode: String(row.mode),
              niveau: String(row.niveau),
              niveau_aide: Number(row.niveau_aide),
              origine: String(row.origine),
              contenu_version: String(row.contenu_version),
              sous_competence: row.sous_competence ? String(row.sous_competence) : null,
              presented_at: String(row.presented_at),
            });
            presented.push({
              ...event,
              created_at: row.created_at ? String(row.created_at) : undefined,
              source: "devoir",
            });
          }
        }
      }

      return presented.sort((a, b) =>
        String(b.created_at ?? b.payload.presented_at).localeCompare(String(a.created_at ?? a.payload.presented_at)),
      );
    },
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ["lot5-attempts", exerciseIds, learnerIds],
    enabled: exerciseIds.length > 0 && learnerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_attempts")
        .select("id, learner_id, exercise_id, session_id, item_results, score_normalized, completed_at, status")
        .in("exercise_id", exerciseIds)
        .in("learner_id", learnerIds)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const devoirCards = useMemo(() => {
    return devoirs.map((d) => {
      const status = presentDevoirStatus(d.statut);
      const eleve = d.eleve as { prenom?: string; nom?: string } | null;
      const exo = d.exercice as { titre?: string; sous_competence?: string } | null;
      return {
        id: d.id,
        status,
        eleveLabel: eleve ? `${eleve.prenom ?? ""} ${eleve.nom ?? ""}`.trim() : d.eleve_id,
        exoTitre: exo?.titre ?? "Exercice",
        sousCompetence: exo?.sous_competence ?? null,
      };
    });
  }, [devoirs]);

  const attemptRows = useMemo(() => {
    const contenuByExercise = new Map<string, unknown>();
    for (const d of devoirs) {
      const exo = d.exercice as { id?: string; contenu?: unknown; sous_competence?: string } | null;
      if (exo?.id) contenuByExercise.set(exo.id, exo.contenu);
    }
    return attempts.map((a) => {
      const devoir = devoirs.find((d) => d.exercice_id === a.exercise_id && d.eleve_id === a.learner_id);
      const exo = devoir?.exercice as { sous_competence?: string; contenu?: unknown } | null;
      const contenu = contenuByExercise.get(a.exercise_id) ?? exo?.contenu;
      const eventsForLearner = helpEvents.filter((e) => e.eleve_id === a.learner_id) as HelpLiveEvent[];
      return buildAttemptOverview({
        attemptId: a.id,
        learnerId: a.learner_id,
        sousCompetence: exo?.sous_competence ?? null,
        itemResults: a.item_results as Record<string, unknown> | null,
        helpEvents: eventsForLearner,
        unloggedClientHintPossible: exerciseAllowsUnloggedClientHint(contenu),
        completedAt: a.completed_at,
        failed: typeof a.score_normalized === "number" ? a.score_normalized < 50 : false,
      });
    });
  }, [attempts, devoirs, helpEvents]);

  const grouped = useMemo(() => {
    const map = new Map<string, AttemptOverviewRow[]>();
    for (const row of attemptRows) {
      const key = `${row.learnerId}::${row.sousCompetence}`;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [attemptRows]);

  const refreshAlerts = () => {
    const now = new Date();
    const windowStart = new Date(now.getTime() - REPEATED_DIFFICULTY_RULE.windowDays * 86400000);
    const evidence = collectDifficultyEvidence({
      attempts: attempts.map((a) => {
        const devoir = devoirs.find((d) => d.exercice_id === a.exercise_id && d.eleve_id === a.learner_id);
        const exo = devoir?.exercice as { sous_competence?: string; contenu?: unknown } | null;
        return {
          attemptId: a.id,
          learnerId: a.learner_id,
          sousCompetence: exo?.sous_competence ?? null,
          itemResults: a.item_results as Record<string, unknown> | null,
          helpEvents: helpEvents.filter((e) => e.eleve_id === a.learner_id) as HelpLiveEvent[],
          unloggedClientHintPossible: exerciseAllowsUnloggedClientHint(exo?.contenu),
          completedAt: a.completed_at,
          failed: typeof a.score_normalized === "number" ? a.score_normalized < 50 : false,
        };
      }),
      windowStart,
      windowEnd: now,
    });
    const next: PedagogicalAlertDraft[] = [];
    for (const ev of evidence) {
      const hit = evaluateRepeatedDifficultyAlert(ev, now);
      if (!hit.triggered || !hit.reason) continue;
      const attemptIds = attempts
        .filter((attempt) => {
          if (attempt.learner_id !== ev.eleveId || !attempt.completed_at) return false;
          const at = new Date(attempt.completed_at);
          if (at < windowStart || at > now) return false;
          const devoir = devoirs.find((item) => item.exercice_id === attempt.exercise_id && item.eleve_id === attempt.learner_id);
          const skill = (devoir?.exercice as { sous_competence?: string } | null)?.sous_competence?.trim() || "non_renseignee";
          return skill === ev.sousCompetence;
        })
        .map((attempt) => attempt.id);
      next.push({
        eleveId: ev.eleveId,
        sousCompetence: ev.sousCompetence,
        ruleId: hit.ruleId,
        reason: hit.reason,
        windowStart: windowStart.toISOString(),
        windowEnd: now.toISOString(),
        evidence: {
          attempt_ids: attemptIds,
          event_ids: [],
          failures_count: ev.failuresInWindow,
          max_help_uses: ev.maxHelpUsesInWindow,
          reason: hit.reason,
        },
      });
    }
    setDrafts(next);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0b234a]">Suivi des aides et difficultés</h1>
        <p className="text-sm text-muted-foreground">
          Autonomie mesurable uniquement si la trace Lot 3 est complète. Les indices client « Voir un indice »
          non journalisés rendent la tentative non mesurable. Pas de score TCF élève ici.
        </p>
      </div>

      <Tabs defaultValue="devoirs">
        <TabsList>
          <TabsTrigger value="devoirs">Devoirs</TabsTrigger>
          <TabsTrigger value="tentatives">Tentatives</TabsTrigger>
          <TabsTrigger value="aides">Aides présentées</TabsTrigger>
          <TabsTrigger value="alertes">Alertes</TabsTrigger>
        </TabsList>

        <TabsContent value="devoirs" className="space-y-3">
          {loadingDevoirs ? <Skeleton className="h-24 w-full" /> : null}
          {devoirCards.map((d) => (
            <Card key={d.id}>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  {d.exoTitre}
                  <Badge variant={d.status.isActive ? "default" : "outline"}>{d.status.label}</Badge>
                </CardTitle>
                <CardDescription>
                  {d.eleveLabel}
                  {d.sousCompetence ? ` · ${d.sousCompetence}` : ""}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
          {!loadingDevoirs && devoirCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun devoir pour ce formateur.</p>
          ) : null}
        </TabsContent>

        <TabsContent value="tentatives" className="space-y-4">
          {[...grouped.entries()].map(([key, rows]) => {
            const [, skill] = key.split("::");
            const autonome = rows.filter((r) => r.autonomy === "autonome");
            const aidees = rows.filter((r) => r.autonomy === "aidee");
            const nonMes = rows.filter((r) => r.autonomy === "non_mesurable");
            return (
              <Card key={key}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">{skill}</CardTitle>
                  <CardDescription>
                    Autonomes {autonome.length} · Aidées {aidees.length} · Non mesurables {nonMes.length}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {rows.map((r) => (
                    <div key={r.attemptId} className="flex flex-wrap items-center gap-2 border-b pb-2">
                      <span className="font-mono text-xs">{r.attemptId.slice(0, 8)}…</span>
                      {autonomyBadge(r.autonomy)}
                      {r.hints.map((h, i) => (
                        <Badge key={i} variant="outline">
                          Indice niv. {h.niveau_aide} ({h.origine})
                        </Badge>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
          {grouped.size === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune tentative complétée visible.</p>
          ) : null}
        </TabsContent>

        <TabsContent value="aides" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Uniquement les indices réellement présentés (banque). Les demandes d’aide Atelier et les traces
            non mesurables n’apparaissent pas ici.
          </p>
          {helpEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun indice présenté journalisé pour ces devoirs (séance ou devoir sans séance).
            </p>
          ) : (
            helpEvents.map((e, idx) => {
              const linked = devoirs.find((d) =>
                (e.payload.devoir_id ? d.id === e.payload.devoir_id : true)
                && d.eleve_id === e.eleve_id
                && d.exercice_id === e.payload.exercice_id
                && (e.source === "devoir" || !d.session_id || d.session_id === e.session_id),
              );
              const eleve = linked?.eleve as { prenom?: string; nom?: string } | null | undefined;
              const exo = linked?.exercice as { titre?: string } | null | undefined;
              const eleveLabel = eleve
                ? `${eleve.prenom ?? ""} ${eleve.nom ?? ""}`.trim()
                : e.eleve_id.slice(0, 8);
              return (
                <Card key={`${e.source}-${e.session_id ?? e.payload.devoir_id}-${e.payload.item_id}-${idx}`}>
                  <CardContent className="py-3 text-sm flex flex-wrap gap-2 items-center">
                    <Badge>Présenté</Badge>
                    <Badge variant="outline">{e.source === "devoir" ? "Devoir" : "Séance"}</Badge>
                    <Badge variant="secondary">niv. {e.payload.niveau_aide}</Badge>
                    <span className="font-medium">{eleveLabel}</span>
                    <span>{exo?.titre ?? e.payload.exercice_id.slice(0, 8)}</span>
                    <span className="text-muted-foreground">item {e.payload.item_id}</span>
                    {e.payload.devoir_id ? (
                      <span className="text-muted-foreground font-mono text-xs">
                        devoir {e.payload.devoir_id.slice(0, 8)}…
                      </span>
                    ) : null}
                    <span className="text-muted-foreground">{e.payload.origine}</span>
                    {e.payload.sous_competence ? (
                      <span className="text-muted-foreground">{e.payload.sous_competence}</span>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="alertes" className="space-y-3">
          <PersistedPedagogicalAlerts
            client={supabase as unknown as PedagogicalAlertsClient}
            formateurId={user?.id ?? ""}
            drafts={drafts}
            onCompute={refreshAlerts}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
