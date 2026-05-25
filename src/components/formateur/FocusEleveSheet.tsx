import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  MessageSquare,
  Play,
  Send,
  XCircle,
  Zap,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EleveStateLive, LiveEvent, NiveauxEleve } from "@/hooks/useLiveSession";

const NIVEAU_COLORS: Record<string, string> = {
  A0: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300",
  A1: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300",
  A2: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300",
  B1: "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-300",
  B2: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300",
};

const ERREUR_LABELS: Record<string, string> = {
  LEX_CONFUSION: "Lexique", CONSIGNE_NC: "Consigne", GRAM_ACCORD: "Accord",
  GRAM_TEMPS: "Temps verbal", HORS_SUJET: "Hors sujet", INTERPRETATION: "Interprétation",
  JUSTIFICATION: "Justification", PHONO: "Phonologie", PRODUCTION_COURTE: "Prod. courte",
  REGISTRE: "Registre", COHERENCE_ADMIN: "Cohérence admin.",
};

const EV_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  exercice_demarre:    { label: "Exercice commencé",     icon: <Play className="h-3 w-3" />,          color: "text-blue-600 dark:text-blue-400" },
  exercice_termine:   { label: "Exercice terminé",       icon: <CheckCircle2 className="h-3 w-3" />,   color: "text-emerald-600 dark:text-emerald-400" },
  reponse_correcte:   { label: "Réponses correctes",     icon: <CheckCircle2 className="h-3 w-3" />,   color: "text-emerald-600 dark:text-emerald-400" },
  reponse_incorrecte: { label: "Réponses incorrectes",   icon: <XCircle className="h-3 w-3" />,        color: "text-red-600 dark:text-red-400" },
  erreur_repetee:     { label: "Erreur répétée",         icon: <AlertTriangle className="h-3 w-3" />,  color: "text-red-600 dark:text-red-400" },
  aide_demandee:      { label: "A demandé de l'aide",    icon: <MessageSquare className="h-3 w-3" />,  color: "text-amber-600 dark:text-amber-400" },
  intervention_recue: { label: "Aide reçue",             icon: <Send className="h-3 w-3" />,           color: "text-primary" },
  fiche_terminee:     { label: "Fiche terminée",         icon: <CheckCircle2 className="h-3 w-3" />,   color: "text-emerald-600 dark:text-emerald-400" },
  inactif:            { label: "Inactif",                icon: <Hourglass className="h-3 w-3" />,      color: "text-muted-foreground" },
};

function fmt(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function minutesSince(isoDate: string) {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
}

export interface FocusEleveSheetProps {
  prenom: string;
  nom: string;
  eleveId: string;
  state: EleveStateLive | undefined;
  priorite: number;
  niveaux: NiveauxEleve | undefined;
  allEvents: LiveEvent[];
  onClose: () => void;
  onIntervenir: () => void;
}

export function FocusEleveSheet({
  prenom, nom, eleveId, state, priorite, niveaux, allEvents, onClose, onIntervenir,
}: FocusEleveSheetProps) {
  // Événements de cet élève, du plus ancien au plus récent
  const eleveEvents = allEvents
    .filter((ev) => ev.eleve_id === eleveId)
    .slice()
    .reverse();

  // Tendance erreurs — count per type_erreur_id (incorrect responses)
  const erreurCounts: Record<string, number> = {};
  for (const ev of allEvents) {
    if (
      ev.eleve_id === eleveId &&
      ev.event_type === "reponse_incorrecte" &&
      ev.type_erreur_id
    ) {
      erreurCounts[ev.type_erreur_id] = (erreurCounts[ev.type_erreur_id] ?? 0) + 1;
    }
  }
  const erreurChartData = Object.entries(erreurCounts)
    .map(([id, count]) => ({
      id,
      label: ERREUR_LABELS[id] ?? id,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const alertLevel = priorite > 10 ? "alert" : priorite >= 4 ? "suggest" : "ok";
  const mins = state?.derniere_activite ? minutesSince(state.derniere_activite) : null;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-lg">
                {prenom} {nom}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {/* Statut live */}
                {state ? (
                  <Badge
                    variant="outline"
                    className={
                      state.statut === "finished"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : state.statut === "playing"
                          ? "bg-blue-50 text-blue-700 border-blue-300"
                          : "bg-amber-50 text-amber-700 border-amber-300"
                    }
                  >
                    {state.statut === "finished" ? "Terminé" : state.statut === "playing" ? "En cours" : "Inactif"}
                  </Badge>
                ) : (
                  <Badge variant="outline">En attente</Badge>
                )}

                {/* Priorité */}
                {alertLevel === "alert" && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Priorité {priorite.toFixed(0)}
                  </Badge>
                )}
                {alertLevel === "suggest" && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 gap-1">
                    <Zap className="h-3 w-3" />
                    Priorité {priorite.toFixed(0)}
                  </Badge>
                )}
              </div>
            </div>

            {/* Bouton intervention */}
            <Button size="sm" className="gap-1.5 shrink-0" onClick={onIntervenir}>
              <Send className="h-3.5 w-3.5" /> Aide
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-5">
            {/* Niveaux CECRL */}
            {niveaux && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Niveaux CECRL
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["CO", "CE", "EE", "EO"] as const).map((comp) => {
                    const n = niveaux[`niveau_${comp.toLowerCase()}` as keyof NiveauxEleve] as string | null | undefined;
                    return (
                      <div key={comp} className="text-center space-y-0.5">
                        <p className="text-[10px] text-muted-foreground font-medium">{comp}</p>
                        {n ? (
                          <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold border ${NIVEAU_COLORS[n] ?? ""}`}>
                            {n}
                          </span>
                        ) : (
                          <span className="inline-block rounded px-2 py-0.5 text-[11px] text-muted-foreground">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dernière activité */}
            {state?.derniere_activite && (
              <div className="text-[12px] text-muted-foreground">
                Dernière activité :{" "}
                <span className="font-medium text-foreground">
                  {mins === 0 ? "à l'instant" : `il y a ${mins} min`}
                </span>
                {state.dernier_type_erreur && (
                  <> · dernière erreur :{" "}
                    <span className="font-medium text-foreground">
                      {ERREUR_LABELS[state.dernier_type_erreur] ?? state.dernier_type_erreur}
                    </span>
                  </>
                )}
              </div>
            )}

            <Separator />

            {/* Timeline des événements */}
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Activité cette séance
              </p>

              {eleveEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Aucun événement enregistré pour cette séance.
                </p>
              ) : (
                <div className="relative pl-4 space-y-3">
                  {/* Ligne verticale */}
                  <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />

                  {eleveEvents.map((ev) => {
                    const cfg = EV_CONFIG[ev.event_type] ?? {
                      label: ev.event_type, icon: null, color: "text-muted-foreground",
                    };
                    const score = (ev.payload as any)?.score;
                    const count = (ev.payload as any)?.correct_count;
                    const erreurLabel = ev.type_erreur_id
                      ? (ERREUR_LABELS[ev.type_erreur_id] ?? ev.type_erreur_id)
                      : null;

                    return (
                      <div key={ev.id} className="flex gap-2.5 items-start">
                        {/* Dot */}
                        <div className={`h-3 w-3 rounded-full border-2 bg-background shrink-0 mt-0.5 ${
                          ev.event_type === "erreur_repetee" ? "border-red-500" :
                          ev.event_type === "reponse_incorrecte" ? "border-red-400" :
                          ev.event_type === "reponse_correcte" || ev.event_type === "exercice_termine" ? "border-emerald-500" :
                          ev.event_type === "intervention_recue" ? "border-primary" :
                          "border-muted-foreground/40"
                        }`} />

                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[11px] font-medium ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            {score != null && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1 py-0 ${
                                  score >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                                  score >= 60 ? "bg-amber-50 text-amber-700 border-amber-300" :
                                  "bg-red-50 text-red-700 border-red-300"
                                }`}
                              >
                                {score}%
                              </Badge>
                            )}
                            {count != null && (
                              <span className="text-[10px] text-emerald-600">{count} correcte{count > 1 ? "s" : ""}</span>
                            )}
                          </div>
                          {erreurLabel && (
                            <p className="text-[10px] text-muted-foreground">{erreurLabel}</p>
                          )}
                          {ev.event_type === "intervention_recue" && (ev.payload as any)?.titre && (
                            <p className="text-[10px] text-muted-foreground italic">
                              « {(ev.payload as any).titre} »
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {fmt(ev.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
