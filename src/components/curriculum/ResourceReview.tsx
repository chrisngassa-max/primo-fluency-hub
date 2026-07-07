import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SessionProgressRow, SessionResource, TrainingSession, ValidationReport } from "@/lib/curriculum/types";
import { formatPalierParcoursLabel, type CurriculumPalier } from "@/lib/curriculum/pilot";
import { CurriculumPilotButton } from "@/components/curriculum/CurriculumPilotButton";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  Hash,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
} from "lucide-react";

const STATUT_COLORS: Record<string, string> = {
  published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  publishable: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  quarantined: "bg-destructive/15 text-destructive",
  generated: "bg-muted text-muted-foreground",
};

interface ResourceReviewProps {
  sessionProgress: SessionProgressRow[];
  reports: ValidationReport[];
  resourcesBySessionCode: Map<string, SessionResource[]>;
  trainingSessionsByCode?: Map<string, TrainingSession>;
  palierCible?: CurriculumPalier;
  selectedSession?: string | null;
  onSelectSession?: (code: string | null) => void;
  onRestoreSession?: (sessionCode: string) => void;
  restoringSession?: string | null;
}

export function ResourceReview({
  sessionProgress,
  reports,
  resourcesBySessionCode,
  trainingSessionsByCode,
  palierCible,
  selectedSession,
  onSelectSession,
  onRestoreSession,
  restoringSession,
}: ResourceReviewProps) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(selectedSession ?? null);

  const quarantinedSessions = useMemo(
    () => sessionProgress.filter((s) => s.quarantined > 0 || s.job_statut === "quarantined"),
    [sessionProgress],
  );

  const filteredSessions = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sessionProgress;
    return sessionProgress.filter(
      (s) => s.session_code.toLowerCase().includes(q) || s.titre.toLowerCase().includes(q),
    );
  }, [sessionProgress, filter]);

  const reportsByResource = useMemo(() => {
    const map = new Map<string, ValidationReport[]>();
    for (const r of reports) {
      if (!r.session_resource_id) continue;
      const list = map.get(r.session_resource_id) ?? [];
      list.push(r);
      map.set(r.session_resource_id, list);
    }
    return map;
  }, [reports]);

  return (
    <div className="space-y-4">
      {quarantinedSessions.length > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{quarantinedSessions.length} séance(s) en quarantaine</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              {quarantinedSessions.map((s) => (
                <li key={s.session_code}>
                  <strong>{s.session_code}</strong> — {s.last_error ?? "Ressource bloquée à la validation ou publication"}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            File de revue post-publication
          </CardTitle>
          <CardDescription>
            Prévisualisation des ressources, scores de validation, versions et empreintes
          </CardDescription>
          <div className="relative max-w-sm pt-2">
            <Search className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrer par code ou titre…"
              className="pl-8"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredSessions.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucune ressource en base pour ce plan. Lancez un batch pour peupler les tables.
            </p>
          )}

          {filteredSessions.map((session) => {
            const sessionResources = resourcesBySessionCode.get(session.session_code) ?? [];
            const trainingSession = trainingSessionsByCode?.get(session.session_code);
            const isOpen = expanded === session.session_code;
            const hasIssue = session.quarantined > 0 || session.version_mismatch;

            return (
              <Collapsible
                key={session.session_code}
                open={isOpen}
                onOpenChange={(open) => {
                  setExpanded(open ? session.session_code : null);
                  onSelectSession?.(open ? session.session_code : null);
                }}
              >
                <div
                  className={cn(
                    "rounded-lg border",
                    hasIssue && "border-destructive/50",
                    session.version_mismatch && "border-amber-500/50",
                  )}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      <span className="font-mono text-sm font-medium w-12">{session.session_code}</span>
                      <span className="flex-1 truncate text-sm">{session.titre}</span>
                      <Badge variant="outline" title={formatPalierParcoursLabel(session.palier)}>
                        {session.palier}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        n°{session.ordre}
                      </span>
                      {session.quarantined > 0 && (
                        <Badge variant="destructive">Quarantaine</Badge>
                      )}
                      {session.version_mismatch && (
                        <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Versions mixtes
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {sessionResources.length} ressource(s)
                      </span>
                      {trainingSession && (
                        <CurriculumPilotButton
                          trainingSession={trainingSession}
                          palierCible={palierCible}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t px-3 pb-3">
                      {session.last_error && (
                        <Alert variant="destructive" className="my-3">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Cause de la quarantaine</AlertTitle>
                          <AlertDescription className="font-mono text-xs">{session.last_error}</AlertDescription>
                        </Alert>
                      )}

                      {sessionResources.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                          Pas encore de ressources persistées pour cette séance.
                        </p>
                      ) : (
                        <ScrollArea className="max-h-[400px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ressource</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead>v.</TableHead>
                                <TableHead>Hash</TableHead>
                                <TableHead>Scores</TableHead>
                                <TableHead>Bloquants</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sessionResources.map((resource) => {
                                const resourceReports = reportsByResource.get(resource.id) ?? [];
                                const aiReport = resourceReports.find((r) => r.validateur === "ai_review");
                                const detReport = resourceReports.find((r) => r.validateur === "deterministic");
                                const bloquants = [
                                  ...(detReport?.bloquants ?? []),
                                  ...(aiReport?.bloquants ?? []),
                                ];

                                return (
                                  <TableRow key={resource.id}>
                                    <TableCell className="font-mono text-xs max-w-[140px] truncate">
                                      {resource.resource_id}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{resource.kind}</TableCell>
                                    <TableCell>
                                      <Badge className={cn("text-xs", STATUT_COLORS[resource.statut])}>
                                        {resource.statut}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">{resource.version}</TableCell>
                                    <TableCell className="font-mono text-[10px] max-w-[100px] truncate" title={resource.hash ?? ""}>
                                      <Hash className="h-3 w-3 inline mr-0.5" />
                                      {resource.hash?.slice(0, 12) ?? "—"}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {aiReport?.scores
                                        ? Object.entries(aiReport.scores as Record<string, unknown>)
                                            .map(([k, v]) => `${k}: ${v}`)
                                            .join(", ") || "—"
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="text-xs text-destructive max-w-[120px]">
                                      {bloquants.length > 0
                                        ? bloquants.map((b, i) => (
                                            <span key={i} className="block truncate">
                                              {typeof b === "string" ? b : JSON.stringify(b)}
                                            </span>
                                          ))
                                        : "—"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      )}

                      {sessionResources.some((r) => r.kind.includes("corrige") || r.resource_id.includes("corrige")) && (
                        <ExercisePreview resources={sessionResources} reports={reportsByResource} />
                      )}

                      <div className="mt-3 flex justify-end gap-2 flex-wrap">
                        {onRestoreSession &&
                          sessionResources.some((r) => r.statut === "published" && r.version > 1) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={restoringSession === session.session_code}
                              onClick={() => onRestoreSession(session.session_code)}
                            >
                              {restoringSession === session.session_code ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <RotateCcw className="h-3 w-3 mr-1" />
                              )}
                              Restaurer la séance
                            </Button>
                          )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ExercisePreview({
  resources,
  reports,
}: {
  resources: SessionResource[];
  reports: Map<string, ValidationReport[]>;
}) {
  const corrige = resources.find((r) => r.resource_id.includes("corrige") || r.kind.includes("corrige"));
  const exercices = resources.find((r) => r.resource_id.includes("exercices") && !r.resource_id.includes("corrige"));

  if (!corrige && !exercices) return null;

  const corrigeMeta = corrige?.metadata as { expected_answer?: string; preview?: string } | undefined;

  return (
    <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm space-y-2">
      <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Aperçu pédagogique</p>
      {exercices && (
        <p>
          <span className="text-muted-foreground">Exercice :</span>{" "}
          {(exercices.metadata as { preview?: string })?.preview ?? exercices.resource_id}
        </p>
      )}
      {corrigeMeta?.expected_answer && (
        <p>
          <span className="text-muted-foreground">Réponse attendue :</span> {corrigeMeta.expected_answer}
        </p>
      )}
      {corrige && (reports.get(corrige.id)?.[0]?.rapport as { source_ids?: string[] })?.source_ids && (
        <p className="text-xs text-muted-foreground">
          Sources :{" "}
          {((reports.get(corrige.id)?.[0]?.rapport as { source_ids?: string[] })?.source_ids ?? []).join(", ")}
        </p>
      )}
    </div>
  );
}

export default ResourceReview;
