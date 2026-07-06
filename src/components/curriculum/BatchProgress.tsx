import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { BatchStatusResponse, CostEstimate, CurriculumBatchEtat, ResourceGenerationBatch } from "@/lib/curriculum/types";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Euro,
  Loader2,
  PauseCircle,
  Play,
  XCircle,
} from "lucide-react";

const ETAT_LABELS: Record<CurriculumBatchEtat, string> = {
  pending: "En attente",
  preflight_failed: "Preflight échoué",
  running: "En cours",
  paused: "En pause",
  published_complete: "Publication complète",
  published_partial: "Publication partielle",
  needs_attention: "Attention requise",
  failed: "Échec",
};

const ETAT_VARIANT: Record<CurriculumBatchEtat, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  preflight_failed: "destructive",
  running: "default",
  paused: "outline",
  published_complete: "default",
  published_partial: "outline",
  needs_attention: "destructive",
  failed: "destructive",
};

function JobStatusIcon({ statut }: { statut: string | null }) {
  if (statut === "succeeded") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (statut === "quarantined" || statut === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  if (statut === "running" || statut === "retrying") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

interface BatchProgressProps {
  batch: ResourceGenerationBatch | null;
  status: BatchStatusResponse | null;
  costEstimate: CostEstimate | null;
  isLoading?: boolean;
  onResume?: () => void;
  resuming?: boolean;
}

export function BatchProgress({ batch, status, costEstimate, isLoading, onResume, resuming }: BatchProgressProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Progression du batch</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </CardContent>
      </Card>
    );
  }

  if (!batch) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Progression du batch</CardTitle>
          <CardDescription>Aucun batch lancé pour ce plan de formation.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const global = status?.global;
  const canResume = batch.etat === "paused" || batch.etat === "needs_attention" || batch.etat === "published_partial";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              Batch {batch.id.slice(0, 8)}…
              <Badge variant={ETAT_VARIANT[batch.etat]}>{ETAT_LABELS[batch.etat]}</Badge>
            </CardTitle>
            <CardDescription>
              Créé le {new Date(batch.created_at).toLocaleString("fr-FR")}
              {batch.started_at && ` · démarré ${new Date(batch.started_at).toLocaleString("fr-FR")}`}
            </CardDescription>
          </div>
          {canResume && onResume && (
            <Button variant="outline" size="sm" onClick={onResume} disabled={resuming}>
              {resuming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Reprendre le batch
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Séances générées" value={global?.generated ?? 0} total={global?.total_sessions} />
            <Metric label="Séances validées" value={global?.validated ?? 0} total={global?.total_sessions} />
            <Metric label="Séances publiées" value={global?.published ?? 0} total={global?.total_sessions} />
            <Metric
              label="Quarantaines"
              value={global?.quarantined ?? 0}
              total={global?.total_sessions}
              destructive={!!global?.quarantined}
            />
          </div>

          {global && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progression globale</span>
                <span className="font-medium">{global.progress_pct}%</span>
              </div>
              <Progress value={global.progress_pct} />
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-sm">
            {batch.cout_estime_eur != null && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Euro className="h-3.5 w-3.5" />
                Estimé : {Number(batch.cout_estime_eur).toFixed(2)} €
              </span>
            )}
            {batch.cout_reel_eur != null && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Euro className="h-3.5 w-3.5" />
                Réel : {Number(batch.cout_reel_eur).toFixed(2)} €
              </span>
            )}
            {costEstimate && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <PauseCircle className="h-3.5 w-3.5" />
                Plafond : {costEstimate.plafond_eur.toFixed(2)} €
                {costEstimate.stubbed && " (estimation indicative)"}
              </span>
            )}
          </div>

          {batch.etat === "running" && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Batch en cours</AlertTitle>
              <AlertDescription>
                Le pipeline s&apos;exécute côté serveur. Cette page se met à jour automatiquement.
                {costEstimate?.stubbed && (
                  <span className="block mt-1 text-xs text-muted-foreground">
                    [STUB] L&apos;orchestration complète requiert le CLI avec BATCH_STORE=supabase.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {status && status.session_progress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Progression par séance</CardTitle>
            <CardDescription>S01–S37 + E1–E4 · état des jobs et ressources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Code</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead className="w-14">Palier</TableHead>
                    <TableHead className="w-24 text-center">Gén.</TableHead>
                    <TableHead className="w-24 text-center">Valid.</TableHead>
                    <TableHead className="w-24 text-center">Publ.</TableHead>
                    <TableHead className="w-20 text-center">Quar.</TableHead>
                    <TableHead className="w-12">État</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status.session_progress.map((row) => (
                    <TableRow
                      key={row.session_code}
                      className={cn(
                        row.quarantined > 0 && "bg-destructive/5",
                        row.version_mismatch && "bg-amber-500/10",
                      )}
                    >
                      <TableCell className="font-mono text-xs">{row.session_code}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm" title={row.titre}>
                        {row.titre}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.palier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">{row.generated}</TableCell>
                      <TableCell className="text-center text-sm">{row.validated}</TableCell>
                      <TableCell className="text-center text-sm">{row.published}</TableCell>
                      <TableCell className="text-center text-sm">
                        {row.quarantined > 0 ? (
                          <span className="text-destructive font-medium">{row.quarantined}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <JobStatusIcon statut={row.job_statut} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {status.session_progress.some((r) => r.version_mismatch) && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Incohérence de versions détectée</AlertTitle>
                <AlertDescription>
                  Au moins une séance a un support et un corrigé de versions différentes. Restauration atomique
                  recommandée avant toute publication.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  total,
  destructive,
}: {
  label: string;
  value: number;
  total?: number;
  destructive?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold", destructive && value > 0 && "text-destructive")}>
        {value}
        {total != null && <span className="text-sm font-normal text-muted-foreground"> / {total}</span>}
      </p>
    </div>
  );
}

export default BatchProgress;
