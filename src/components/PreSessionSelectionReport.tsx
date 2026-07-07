import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  ExclusionCode,
  HumanReviewType,
  PreSessionSelectionParams,
  PreSessionSelectionReport as PreSessionSelectionReportData,
  SelectionTier,
} from "@/lib/pre-session-selection";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  Loader2,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";

export interface PreSessionSelectionReportProps {
  report: PreSessionSelectionReportData | null;
  selectionParams: PreSessionSelectionParams | PreSessionSelectionParams[];
  isLoading?: boolean;
  error?: string | null;
  linkedExerciceIds: string[];
  lot8ComplementEnabled: boolean;
  appliedExerciceIds?: string[];
  onApplySelection: (exerciceIds: string[]) => void | Promise<void>;
  onRequestComplement: (report: PreSessionSelectionReportData) => void;
  isApplying?: boolean;
}

const EXCLUSION_LABELS: Record<ExclusionCode, string> = {
  EXCL_VALIDATION_REJECTED: "Rejeté (validation)",
  EXCL_VALIDATION_DRAFT: "Brouillon",
  EXCL_SCORE_LOW: "Score insuffisant",
  EXCL_SCORING: "Exclu (scoring)",
  EXCL_FORMAT: "Format non autorisé",
  EXCL_STALE: "Récemment utilisé",
  EXCL_NR_TIER_ROUGE: "NR tier rouge",
  EXCL_NR_THEME_SENSIBLE: "NR thème sensible",
  EXCL_ALREADY_LINKED: "Déjà lié à la séance",
  EXCL_NOT_USABLE: "Contenu non utilisable",
  EXCL_COMPETENCE: "Compétence différente",
  EXCL_NIVEAU: "Niveau hors fenêtre",
};

const TIER_LABELS: Record<SelectionTier, string> = {
  P1_validated: "P1 validé",
  P2_nr_vert: "P2 NR vert",
  P2_nr_orange: "P2 NR orange",
};

const TIER_CLASSES: Record<SelectionTier, string> = {
  P1_validated: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  P2_nr_vert: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  P2_nr_orange: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

const HUMAN_REVIEW_ICONS: Record<HumanReviewType, typeof AlertTriangle> = {
  NR_REPLI_USED: AlertTriangle,
  NR_TIER_ROUGE_SKIPPED: XCircle,
  SENSITIVE_THEME_GAP: ShieldAlert,
  AMBIGUOUS_CORRECTION_NEARBY: HelpCircle,
  P0_BLOCKING: Ban,
};

const SEVERITY_CLASSES = {
  none: "bg-muted text-muted-foreground",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function formatMetaDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function normalizeParams(
  params: PreSessionSelectionParams | PreSessionSelectionParams[],
): PreSessionSelectionParams[] {
  return Array.isArray(params) ? params : [params];
}

export function PreSessionSelectionReport({
  report,
  selectionParams,
  isLoading = false,
  error = null,
  linkedExerciceIds,
  lot8ComplementEnabled,
  appliedExerciceIds = [],
  onApplySelection,
  onRequestComplement,
  isApplying = false,
}: PreSessionSelectionReportProps) {
  const [excludedOpen, setExcludedOpen] = useState(false);
  const paramsList = normalizeParams(selectionParams);

  const appliedSet = useMemo(() => new Set(appliedExerciceIds), [appliedExerciceIds]);
  const linkedSet = useMemo(() => new Set(linkedExerciceIds), [linkedExerciceIds]);

  const pendingApplyIds = useMemo(() => {
    if (!report) return [];
    return report.retained
      .map((r) => r.exercice_id)
      .filter((id) => !linkedSet.has(id) && !appliedSet.has(id));
  }, [report, linkedSet, appliedSet]);

  const sessionAlreadyPopulated = linkedExerciceIds.length > 0;

  if (isLoading) {
    return (
      <div className="rounded-md border bg-background/60 p-4 space-y-3" data-testid="pre-session-report-loading">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm font-medium">Rapport de sélection pré-séance</span>
        </div>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" data-testid="pre-session-report-error">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Erreur rapport pré-séance</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!report) {
    return (
      <div
        className="rounded-md border border-dashed p-4 text-sm text-muted-foreground text-center"
        data-testid="pre-session-report-empty"
      >
        Aucun rapport de sélection disponible pour cette séance.
      </div>
    );
  }

  const generationNeeded = report.generation_need.required;
  const excludedEntries = Object.entries(report.excluded.counts).filter(
    ([, count]) => (count ?? 0) > 0,
  ) as [ExclusionCode, number][];
  const sortedHumanReview = [...report.human_review_items].sort((a, b) => {
    if (a.priority === b.priority) return 0;
    return a.priority === "haute" ? -1 : 1;
  });

  const applyTooltip =
    "Phase signal-only : l'application de la sélection sera disponible ultérieurement.";
  const complementTooltip = !lot8ComplementEnabled
    ? "Disponible après validation Lot 8 (generated_strict)."
    : !generationNeeded
      ? "Aucun complément IA requis pour cette séance."
      : "Phase signal-only : le complément IA sera disponible ultérieurement.";

  return (
    <div
      className="rounded-md border bg-background/60 p-4 space-y-4"
      data-testid="pre-session-report"
      data-generation-state={generationNeeded ? "generation_needed" : "no_generation_needed"}
    >
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Rapport de sélection pré-séance</h4>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                generationNeeded
                  ? "border-amber-500 text-amber-700 dark:text-amber-400"
                  : "border-green-500 text-green-700 dark:text-green-400",
              )}
            >
              {generationNeeded ? "Complément requis" : "Banque suffisante"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {paramsList.map((p) => `${p.niveauVise} · ${p.competence} · quota ${p.quota}`).join(" · ")}
            {" · "}
            Calculé le {formatMetaDate(report.meta.generated_at)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Pools P1: {report.meta.p1_pool} · P2 vert: {report.meta.p2_pool_vert} · P2 orange:{" "}
            {report.meta.p2_pool_orange}
            {report.meta.nr_fallback_allowed ? " · Repli NR autorisé" : " · Repli NR bloqué"}
          </p>
        </div>
      </div>

      {sessionAlreadyPopulated && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Séance déjà peuplée</AlertTitle>
          <AlertDescription>
            {linkedExerciceIds.length} exercice(s) déjà lié(s) — ce rapport est informatif.
          </AlertDescription>
        </Alert>
      )}

      {/* generation_need bandeau */}
      {generationNeeded ? (
        <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <AlertTitle>Complément IA signalé</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>
              Écart total : <strong>{report.generation_need.total_gap}</strong> · Estimation génération :{" "}
              <strong>{report.generation_need.estimated_generation_count}</strong>
            </p>
            {report.generation_need.defer_to_lot8_p0 && (
              <p className="text-amber-700 dark:text-amber-400">
                Cellule P0 — complément différé au pipeline Lot 8.
              </p>
            )}
            {report.generation_need.slots.map((slot) => (
              <p key={`${slot.competence}-${slot.niveau_vise}`} className="text-xs">
                {slot.competence} {slot.niveau_vise} : gap {slot.gap} ({slot.reason})
              </p>
            ))}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Aucun complément requis</AlertTitle>
          <AlertDescription>
            Le quota est couvert par la banque ({report.retained.length} retenu
            {report.retained.length > 1 ? "s" : ""}).
          </AlertDescription>
        </Alert>
      )}

      {/* retained */}
      <section>
        <h5 className="text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">
          Retenus ({report.retained.length})
        </h5>
        {report.retained.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aucun exercice retenu automatiquement.</p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Titre</TableHead>
                  <TableHead className="text-xs w-[80px]">Comp.</TableHead>
                  <TableHead className="text-xs w-[90px]">Tier</TableHead>
                  <TableHead className="text-xs w-[60px] text-right">Score</TableHead>
                  <TableHead className="text-xs w-[70px]">Fraîcheur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.retained.map((r) => (
                  <TableRow key={r.exercice_id}>
                    <TableCell className="text-xs font-medium max-w-[200px] truncate">
                      {r.titre || "Sans titre"}
                      {linkedSet.has(r.exercice_id) && (
                        <Badge variant="secondary" className="ml-1 text-[9px]">
                          déjà lié
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{r.competence ?? "?"}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[9px]", TIER_CLASSES[r.selection_tier])}>
                        {TIER_LABELS[r.selection_tier]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{r.score}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px]",
                          r.fresh
                            ? "border-green-500 text-green-700"
                            : "border-muted-foreground text-muted-foreground",
                        )}
                      >
                        {r.fresh ? "Frais" : "Stale"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* excluded */}
      <Collapsible open={excludedOpen} onOpenChange={setExcludedOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors">
          {excludedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Exclus ({excludedEntries.reduce((sum, [, n]) => sum + n, 0)})
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-2">
          {excludedEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Aucune exclusion.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {excludedEntries.map(([code, count]) => (
                  <Badge key={code} variant="outline" className="text-[10px]">
                    {EXCLUSION_LABELS[code] ?? code} ({count})
                  </Badge>
                ))}
              </div>
              {report.excluded.samples.length > 0 && (
                <ul className="text-xs space-y-1 border rounded-md p-2 bg-muted/30">
                  {report.excluded.samples.slice(0, 5).map((s) => (
                    <li key={`${s.exercice_id}-${s.reason}`} className="truncate">
                      <span className="text-muted-foreground">{EXCLUSION_LABELS[s.reason] ?? s.reason}</span>
                      {" — "}
                      {s.titre || s.exercice_id}
                      {s.detail ? ` (${s.detail})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* remaining_gaps */}
      <section>
        <h5 className="text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">
          Écarts restants
        </h5>
        {report.remaining_gaps.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aucun écart.</p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Cellule</TableHead>
                  <TableHead className="text-xs text-right">Demandé</TableHead>
                  <TableHead className="text-xs text-right">VA</TableHead>
                  <TableHead className="text-xs text-right">NR</TableHead>
                  <TableHead className="text-xs text-right">Gap</TableHead>
                  <TableHead className="text-xs">Sévérité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.remaining_gaps.map((g) => (
                  <TableRow key={g.cell_key}>
                    <TableCell className="text-xs font-mono">
                      {g.cell_key}
                      {g.is_p0_cell && (
                        <Badge variant="outline" className="ml-1 text-[9px]">
                          P0
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{g.requested}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{g.retained_va}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{g.retained_nr}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums font-medium">{g.gap}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[9px]", SEVERITY_CLASSES[g.severity])}>
                        {g.severity}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* human_review_items */}
      {sortedHumanReview.length > 0 && (
        <section>
          <h5 className="text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">
            Relecture humaine ({sortedHumanReview.length})
          </h5>
          <ul className="space-y-1.5">
            {sortedHumanReview.map((item, idx) => {
              const Icon = HUMAN_REVIEW_ICONS[item.type];
              return (
                <li
                  key={`${item.type}-${item.cell_key}-${idx}`}
                  className={cn(
                    "flex items-start gap-2 text-xs rounded-md border p-2",
                    item.priority === "haute" && "border-orange-300 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px]",
                          item.priority === "haute" && "border-orange-500 text-orange-700",
                        )}
                      >
                        {item.priority}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">{item.cell_key}</span>
                    </div>
                    <p className="mt-0.5">{item.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Actions signal-only — toujours désactivées en phase 1 */}
      <TooltipProvider>
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1.5 pointer-events-none"
                  disabled
                  onClick={() => onApplySelection(pendingApplyIds)}
                  aria-disabled
                >
                  {isApplying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Appliquer la sélection
                  {pendingApplyIds.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] ml-1">
                      {pendingApplyIds.length}
                    </Badge>
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{applyTooltip}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5 pointer-events-none"
                  disabled
                  onClick={() => onRequestComplement(report)}
                  aria-disabled
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Compléter par IA
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{complementTooltip}</TooltipContent>
          </Tooltip>

          <p className="text-[11px] text-muted-foreground ml-auto">
            Aperçu signal-only — aucune action automatique
          </p>
        </div>
      </TooltipProvider>
    </div>
  );
}
