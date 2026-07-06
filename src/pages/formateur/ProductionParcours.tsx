import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { BatchProgress } from "@/components/curriculum/BatchProgress";
import { ResourceReview } from "@/components/curriculum/ResourceReview";
import { VersionHistory } from "@/components/curriculum/VersionHistory";
import {
  estimateBatchCost,
  fetchActivePlanVersion,
  fetchLatestBatch,
  fetchPublications,
  fetchSessionResources,
  fetchTrainingSessions,
  fetchValidationReports,
  loadBatchStatus,
  resumeBatch,
  restorePublication,
  restoreSession,
  startBatch,
} from "@/lib/curriculum/api";
import { CURRICULUM_PLAN_VERSION_LABEL, CURRICULUM_SESSIONS } from "@/lib/curriculum/sessions";
import {
  Factory,
  Info,
  Loader2,
  Play,
  RefreshCw,
  Rocket,
} from "lucide-react";

const DEFAULT_FROM = "S01";
const DEFAULT_TO = "S37";

export default function ProductionParcours() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [publish, setPublish] = useState(true);
  const [costCap, setCostCap] = useState("50");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoringSession, setRestoringSession] = useState<string | null>(null);

  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["curriculum-plan-version"],
    queryFn: fetchActivePlanVersion,
    enabled: !!user,
  });

  const { data: batch, isLoading: batchLoading } = useQuery({
    queryKey: ["curriculum-latest-batch", plan?.id],
    queryFn: () => fetchLatestBatch(plan!.id),
    enabled: !!plan?.id,
  });

  const isRunning = batch?.etat === "running" || batch?.etat === "pending";

  const { data: batchStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["curriculum-batch-status", batch?.id],
    queryFn: () => loadBatchStatus(batch!.id),
    enabled: !!batch?.id,
    refetchInterval: isRunning ? 5000 : false,
  });

  const { data: costEstimate } = useQuery({
    queryKey: ["curriculum-cost-estimate", plan?.id, from, to, publish],
    queryFn: () =>
      estimateBatchCost({
        plan_version_id: plan!.id,
        from,
        to,
        publish,
      }),
    enabled: !!plan?.id,
  });

  const { data: dbSessions = [] } = useQuery({
    queryKey: ["curriculum-training-sessions", plan?.id],
    queryFn: () => fetchTrainingSessions(plan!.id),
    enabled: !!plan?.id,
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["curriculum-session-resources", dbSessions.map((s) => s.id).join(",")],
    queryFn: () => fetchSessionResources(dbSessions.map((s) => s.id)),
    enabled: dbSessions.length > 0,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["curriculum-validation-reports", resources.map((r) => r.id).join(",")],
    queryFn: () => fetchValidationReports(resources.map((r) => r.id)),
    enabled: resources.length > 0,
  });

  const { data: publications = [] } = useQuery({
    queryKey: ["curriculum-publications", plan?.id],
    queryFn: () => fetchPublications(plan!.id),
    enabled: !!plan?.id,
  });

  const resourcesBySessionCode = useMemo(() => {
    const codeById = new Map(dbSessions.map((s) => [s.id, s.code]));
    const map = new Map<string, typeof resources>();
    for (const r of resources) {
      const code = codeById.get(r.session_id);
      if (!code) continue;
      const list = map.get(code) ?? [];
      list.push(r);
      map.set(code, list);
    }
    return map;
  }, [dbSessions, resources]);

  const sessionProgress = batchStatus?.session_progress ?? [];

  const startMutation = useMutation({
    mutationFn: () =>
      startBatch({
        plan_version_id: plan!.id,
        from,
        to,
        publish,
        cost_cap_eur: parseFloat(costCap) || 50,
      }),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["curriculum-latest-batch"] });
      queryClient.invalidateQueries({ queryKey: ["curriculum-batch-status"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Impossible de démarrer le batch"),
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeBatch(batch!.id),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["curriculum-batch-status"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Impossible de reprendre le batch"),
  });

  const handleRestoreSession = useCallback(
    async (sessionCode: string) => {
      if (!plan?.id) return;
      setRestoringSession(sessionCode);
      try {
        const result = await restoreSession({
          plan_version_id: plan.id,
          session_code: sessionCode,
          cohort_check: true,
        });
        if (result.ok) {
          toast.success(result.message);
          queryClient.invalidateQueries({ queryKey: ["curriculum-publications"] });
          queryClient.invalidateQueries({ queryKey: ["curriculum-session-resources"] });
          queryClient.invalidateQueries({ queryKey: ["curriculum-batch-status"] });
        } else {
          toast.error(result.message);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Restauration de séance impossible");
      } finally {
        setRestoringSession(null);
      }
    },
    [plan?.id, queryClient],
  );

  const handleRestore = useCallback(
    async (publicationId: string) => {
      setRestoringId(publicationId);
      try {
        const result = await restorePublication({ publication_id: publicationId, cohort_check: true });
        if (result.ok) {
          toast.success(result.message);
          queryClient.invalidateQueries({ queryKey: ["curriculum-publications"] });
          queryClient.invalidateQueries({ queryKey: ["curriculum-session-resources"] });
        } else {
          toast.error(result.message);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Restauration impossible");
      } finally {
        setRestoringId(null);
      }
    },
    [queryClient],
  );

  const sessionCount = useMemo(() => {
    const fromIdx = CURRICULUM_SESSIONS.findIndex((s) => s.session_code === from);
    const toIdx = CURRICULUM_SESSIONS.findIndex((s) => s.session_code === to);
    if (fromIdx === -1 || toIdx === -1 || fromIdx > toIdx) return 0;
    return toIdx - fromIdx + 1;
  }, [from, to]);

  if (planLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Plan de formation introuvable</AlertTitle>
          <AlertDescription>
            Aucune entrée dans <code>training_plan_versions</code>. Appliquez la migration curriculum v2 et
            initialisez le plan avant de lancer la production.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Factory className="h-7 w-7 text-primary" />
            Production du parcours
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Plan {plan.version} ({CURRICULUM_PLAN_VERSION_LABEL}) · génération, validation et publication CapTCF
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["curriculum-batch-status"] });
            queryClient.invalidateQueries({ queryKey: ["curriculum-latest-batch"] });
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Lancer le batch unique
            </CardTitle>
            <CardDescription>
              Orchestrateur generate → validate → publish (section 9)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="from">De</Label>
                <Input id="from" value={from} onChange={(e) => setFrom(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">À</Label>
                <Input id="to" value={to} onChange={(e) => setTo(e.target.value.toUpperCase())} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{sessionCount} séance(s) ciblée(s)</p>

            <div className="flex items-center justify-between">
              <Label htmlFor="publish" className="cursor-pointer">
                Publication automatique
              </Label>
              <Switch id="publish" checked={publish} onCheckedChange={setPublish} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cap">Plafond de coût (€)</Label>
              <Input
                id="cap"
                type="number"
                min={0}
                step={1}
                value={costCap}
                onChange={(e) => setCostCap(e.target.value)}
              />
            </div>

            {costEstimate && (
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <p>
                  Estimation : <strong>{costEstimate.cout_estime_eur.toFixed(2)} €</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Plafond configuré : {costEstimate.plafond_eur.toFixed(2)} €
                  {costEstimate.stubbed && " · [STUB] basé sur le nombre de séances"}
                </p>
              </div>
            )}

            <Button
              className="w-full"
              disabled={startMutation.isPending || isRunning || sessionCount === 0}
              onClick={() => startMutation.mutate()}
            >
              {startMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Démarrer le batch
            </Button>

            {isRunning && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Un batch est déjà en cours. Reprenez-le ou attendez la fin.
              </p>
            )}
          </CardContent>
        </Card>

        <BatchProgress
          batch={batch ?? null}
          status={batchStatus ?? null}
          costEstimate={costEstimate ?? null}
          isLoading={batchLoading || statusLoading}
          onResume={() => resumeMutation.mutate()}
          resuming={resumeMutation.isPending}
        />
      </div>

      <Tabs defaultValue="review">
        <TabsList>
          <TabsTrigger value="review">Revue des ressources</TabsTrigger>
          <TabsTrigger value="history">Historique & restauration</TabsTrigger>
        </TabsList>
        <TabsContent value="review" className="mt-4">
          <ResourceReview
            sessionProgress={sessionProgress}
            reports={reports}
            resourcesBySessionCode={resourcesBySessionCode}
            selectedSession={selectedSession}
            onSelectSession={setSelectedSession}
            onRestoreSession={handleRestoreSession}
            restoringSession={restoringSession}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <VersionHistory
            publications={publications}
            resources={resources}
            onRestore={handleRestore}
            restoringId={restoringId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
