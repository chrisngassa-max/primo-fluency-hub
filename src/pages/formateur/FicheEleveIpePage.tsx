import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  ClipboardList,
  AlertTriangle,
  FileText,
  Sparkles,
  ListChecks,
  Info,
  Landmark,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import GenerateTargetedExerciseWizard from "@/components/formateur/GenerateTargetedExerciseWizard";
import { useEleveReadinessFiche } from "@/hooks/useEleveReadinessFiche";
import {
  BANDE_COLORS,
  BANDE_LABELS,
  COMPETENCE_LABELS,
  EPREUVES,
  type ReadinessCompetence,
  scoreTrend,
} from "@/lib/readinessDisplay";

const PROGRESSION_COLORS: Record<string, string> = {
  GLOBAL: "hsl(var(--primary))",
  CO: "#2563eb",
  CE: "#16a34a",
  EE: "#f59e0b",
  EO: "#dc2626",
  ST: "#7c3aed",
};

const FicheEleveIpePage = () => {
  const { eleveId } = useParams<{ eleveId: string }>();
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    error,
    recalculate,
    recalculating,
    global,
    bandConfig,
    staleDays,
  } = useEleveReadinessFiche(eleveId);

  const [progressionToggles, setProgressionToggles] = useState<
    Record<ReadinessCompetence, boolean>
  >({
    GLOBAL: true,
    CO: false,
    CE: false,
    EE: false,
    EO: false,
    ST: false,
  });
  const [wizardOpen, setWizardOpen] = useState(false);

  const trend = useMemo(() => {
    if (!global || !data?.previousGlobal) return null;
    return scoreTrend(Number(global.score), Number(data.previousGlobal.score));
  }, [global, data?.previousGlobal]);

  const radarData = useMemo(() => {
    if (!data) return [];
    return EPREUVES.map((c) => ({
      competence: c,
      score: data.latest.get(c)?.score ?? 0,
    }));
  }, [data]);

  const stSnapshot = data?.latest.get("ST");
  const insufficientData = global?.confiance === "insuffisante";
  const config = data?.config;
  const bandStyle = global ? BANDE_COLORS[global.bande] : null;

  const toggleProgression = (c: ReadinessCompetence) => {
    setProgressionToggles((prev) => ({ ...prev, [c]: !prev[c] }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error || !data || !eleveId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Impossible de charger la fiche IPE.
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = `${data.profile?.prenom ?? ""} ${data.profile?.nom ?? ""}`.trim() || "Élève";

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Fiche préparation examen</h1>
          <p className="text-muted-foreground text-sm">
            {displayName}
            {data.parcoursTitre && <> · {data.parcoursTitre}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.isStale && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              Données &gt; {staleDays} j
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void recalculate()}
            disabled={recalculating}
          >
            {recalculating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Recalculer
          </Button>
        </div>
      </div>

      {/* 1. Cap examen — Langue + Civique */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className={cn("border-2 lg:col-span-2", bandStyle?.border)}>
        <CardHeader className={cn("pb-2", bandStyle?.bg)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Cap examen — {data.objectifLibelle} ({data.objectif})
            </CardTitle>
            {global && (
              <Badge className={cn("text-sm", bandStyle?.bg, bandStyle?.text)}>
                {BANDE_LABELS[global.bande]}
              </Badge>
            )}
          </div>
          <CardDescription>
            Objectif issu du parcours · Estimation — en cours de calibration
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {insufficientData || !global ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/60">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <p className="text-sm font-medium">
                {config?.confidence_rules?.message_insuffisant ??
                  "Données insuffisantes pour une estimation fiable"}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <p className="text-4xl font-bold tabular-nums">{Math.round(Number(global.score))}</p>
                  <p className="text-xs text-muted-foreground">IPE global / 100</p>
                </div>
                {trend != null && (
                  <div
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium",
                      trend > 0
                        ? "text-emerald-600"
                        : trend < 0
                          ? "text-red-600"
                          : "text-muted-foreground",
                    )}
                  >
                    {trend > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : trend < 0 ? (
                      <TrendingDown className="h-4 w-4" />
                    ) : (
                      <Minus className="h-4 w-4" />
                    )}
                    {trend > 0 ? "+" : ""}
                    {trend} pts vs snapshot précédent
                  </div>
                )}
                {data.lastComputedAt && (
                  <p className="text-xs text-muted-foreground ml-auto">
                    Calculé le{" "}
                    {format(new Date(data.lastComputedAt), "d MMM yyyy à HH:mm", { locale: fr })}
                  </p>
                )}
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full transition-all rounded-full", bandStyle?.bar ?? "bg-primary")}
                  style={{ width: `${Number(global.score)}%` }}
                />
              </div>
              {bandConfig && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">{bandConfig.message_formateur}</p>
                  <p className="text-sm text-muted-foreground">{bandConfig.recommandation}</p>
                </div>
              )}
            </>
          )}
          <p className="text-xs text-muted-foreground border-t pt-3 flex gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {config?.disclaimer_fr ??
              "Estimation pédagogique interne — ne garantit pas le score officiel TCF IRN."}
          </p>
        </CardContent>
      </Card>

      <Card className="border-2 border-dashed border-muted-foreground/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            IPE Civique
          </CardTitle>
          <CardDescription>Examen civique — score distinct de l'IPE Langue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-4xl font-bold tabular-nums text-muted-foreground">—</p>
            <p className="text-xs text-muted-foreground">IPE Civique / 100</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Module en construction — QCM bientôt disponibles.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/formateur/preparation-civique">Voir le parcours civique</Link>
          </Button>
        </CardContent>
      </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. Radar + socle ST */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">4 épreuves TCF IRN</CardTitle>
            <CardDescription>Scores IPE par compétence (0–100)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="competence" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="IPE"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.35}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-3 rounded-lg border bg-muted/30 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Socle Structures (modérateur, hors radar)
              </p>
              {stSnapshot ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{COMPETENCE_LABELS.ST}</span>
                  <div className="flex items-center gap-2 flex-1 max-w-xs">
                    <Progress value={Number(stSnapshot.score)} className="h-2 flex-1 [&>div]:bg-violet-500" />
                    <span className="text-sm font-bold tabular-nums w-10 text-right">
                      {stSnapshot.confiance === "insuffisante"
                        ? "—"
                        : Math.round(Number(stSnapshot.score))}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun snapshot ST</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 5. Ce qui coûte des points */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Ce qui coûte des points
            </CardTitle>
            <CardDescription>Top 3 erreurs pondérées (28 derniers jours)</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topErrors.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Aucune erreur significative sur la période.
              </p>
            ) : (
              <div className="space-y-3">
                {data.topErrors.map((err, i) => (
                  <div
                    key={err.typeId}
                    className="flex items-center justify-between p-3 rounded-lg border bg-destructive/5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {i + 1}. {err.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {err.occurrences} occurrence{err.occurrences > 1 ? "s" : ""} · gravité{" "}
                        {err.gravite}/5
                      </p>
                    </div>
                    <Badge variant="destructive" className="shrink-0 tabular-nums">
                      −{err.weight.toFixed(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Progression */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Progression hebdomadaire</CardTitle>
          <CardDescription>Historique des snapshots IPE</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {(Object.keys(progressionToggles) as ReadinessCompetence[]).map((c) => (
              <div key={c} className="flex items-center gap-2">
                <Checkbox
                  id={`prog-${c}`}
                  checked={progressionToggles[c]}
                  onCheckedChange={() => toggleProgression(c)}
                />
                <Label htmlFor={`prog-${c}`} className="text-sm cursor-pointer">
                  {COMPETENCE_LABELS[c]}
                </Label>
              </div>
            ))}
          </div>
          {data.weeklyProgression.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Pas encore d'historique — lancez un recalcul pour générer des snapshots.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.weeklyProgression}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Legend />
                  {(Object.keys(progressionToggles) as ReadinessCompetence[])
                    .filter((c) => progressionToggles[c])
                    .map((c) => (
                      <Line
                        key={c}
                        type="monotone"
                        dataKey={c}
                        name={COMPETENCE_LABELS[c]}
                        stroke={PROGRESSION_COLORS[c]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 4. Devoirs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Devoirs (28 jours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "aFaire", label: "À faire", color: "bg-slate-100 text-slate-700" },
                { key: "enCours", label: "En cours", color: "bg-sky-100 text-sky-700" },
                { key: "termines", label: "Terminés", color: "bg-emerald-100 text-emerald-700" },
                { key: "retard", label: "En retard", color: "bg-red-100 text-red-700" },
              ].map(({ key, label, color }) => (
                <div key={key} className={cn("rounded-lg p-4 text-center", color)}>
                  <p className="text-2xl font-bold tabular-nums">
                    {data.devoirsCounts[key as keyof typeof data.devoirsCounts]}
                  </p>
                  <p className="text-xs font-medium">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 6. Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Actions</CardTitle>
            <CardDescription>Pilotage formateur</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() =>
                toast.info("Rapport écrit — disponible au Sprint C", {
                  description: "Génération PDF / envoi parent à venir.",
                })
              }
            >
              <FileText className="h-4 w-4 mr-2" />
              Générer rapport écrit
              <Badge variant="secondary" className="ml-auto text-[10px]">
                Sprint C
              </Badge>
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => setWizardOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Exercices ciblés
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/formateur/suivi-devoirs">
                <ListChecks className="h-4 w-4 mr-2" />
                Suivi devoirs
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <GenerateTargetedExerciseWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        eleveId={eleveId}
        mode="devoir"
      />
    </div>
  );
};

export default FicheEleveIpePage;
