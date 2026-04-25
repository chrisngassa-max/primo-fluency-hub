import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Flag,
  CheckCircle2,
  ExternalLink,
  ImageOff,
  Sparkles,
  Undo2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  resolu: "Résolu",
};

const PROBLEM_TYPE_LABELS: Record<string, { label: string; variant: any }> = {
  contenu: { label: "Contenu", variant: "destructive" },
  technique: { label: "Technique", variant: "secondary" },
  pedagogique: { label: "Pédagogique", variant: "outline" },
  inconnu: { label: "Inconnu", variant: "outline" },
};

export default function SignalementsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"rapport" | "nouveau" | "resolu">("rapport");

  const { data: reports, isLoading } = useQuery({
    queryKey: ["exercise-reports", user?.id, tab],
    enabled: !!user && tab !== "rapport",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_reports")
        .select("*, eleve:profiles!exercise_reports_eleve_id_fkey(prenom, nom, email)")
        .eq("formateur_id", user!.id)
        .in("status", tab === "nouveau" ? ["nouveau", "en_cours"] : ["resolu"])
        .order("created_at", { ascending: false });
      if (error) {
        const { data: d2 } = await supabase
          .from("exercise_reports")
          .select("*")
          .eq("formateur_id", user!.id)
          .in("status", tab === "nouveau" ? ["nouveau", "en_cours"] : ["resolu"])
          .order("created_at", { ascending: false });
        return d2 ?? [];
      }
      return data ?? [];
    },
  });

  const { data: dailyReports, isLoading: loadingDaily } = useQuery({
    queryKey: ["daily-reports", user?.id],
    enabled: !!user && tab === "rapport",
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("formateur_id", user!.id)
        .order("report_date", { ascending: false })
        .order("kind", { ascending: false })
        .limit(14);
      return data ?? [];
    },
  });

  const markResolved = async (id: string) => {
    const { error } = await supabase
      .from("exercise_reports")
      .update({
        status: "resolu",
        resolved_at: new Date().toISOString(),
        resolved_by: user!.id,
      })
      .eq("id", id);
    if (error) return toast.error("Échec de la mise à jour");
    toast.success("Signalement résolu");
    qc.invalidateQueries({ queryKey: ["exercise-reports"] });
  };

  const confirmCorrection = async (id: string) => {
    const { error } = await supabase
      .from("exercise_reports")
      .update({
        formateur_decision: "confirmed",
        formateur_decision_at: new Date().toISOString(),
        status: "resolu",
        resolved_at: new Date().toISOString(),
        resolved_by: user!.id,
      })
      .eq("id", id);
    if (error) return toast.error("Échec de la confirmation");
    toast.success("Correction confirmée ✅");
    qc.invalidateQueries({ queryKey: ["exercise-reports"] });
  };

  const revertCorrection = async (report: any) => {
    if (!report.exercice_snapshot || !report.exercice_id) {
      toast.error("Aucun snapshot disponible");
      return;
    }
    const { error: e1 } = await supabase
      .from("exercices")
      .update({
        contenu: report.exercice_snapshot,
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.exercice_id);
    if (e1) return toast.error("Échec de la restauration");
    await supabase
      .from("exercise_reports")
      .update({
        formateur_decision: "reverted",
        formateur_decision_at: new Date().toISOString(),
      })
      .eq("id", report.id);
    toast.success("Correction annulée, version originale restaurée");
    qc.invalidateQueries({ queryKey: ["exercise-reports"] });
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Flag className="h-6 w-6 text-destructive" />
          Signalements d'exercices
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Problèmes remontés par les élèves. L'IA analyse et corrige automatiquement
          quand c'est possible — vous validez les corrections appliquées.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="rapport">📊 Rapport du jour</TabsTrigger>
          <TabsTrigger value="nouveau">À traiter</TabsTrigger>
          <TabsTrigger value="resolu">Résolus</TabsTrigger>
        </TabsList>

        <TabsContent value="rapport" className="space-y-4 mt-4">
          {loadingDaily ? (
            <Skeleton className="h-40 w-full" />
          ) : !dailyReports || dailyReports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucun rapport encore généré. Les rapports automatiques sont créés
                à 7h (résumé du matin) et 19h (récap du soir).
              </CardContent>
            </Card>
          ) : (
            dailyReports.map((dr: any) => <DailyReportCard key={dr.id} dr={dr} />)
          )}
        </TabsContent>

        <TabsContent value="nouveau" className="space-y-4 mt-4">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !reports || reports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucun signalement à traiter.
              </CardContent>
            </Card>
          ) : (
            reports.map((r: any) => (
              <ReportCard
                key={r.id}
                report={r}
                onResolve={markResolved}
                onConfirm={confirmCorrection}
                onRevert={revertCorrection}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="resolu" className="space-y-4 mt-4">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !reports || reports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucun signalement résolu.
              </CardContent>
            </Card>
          ) : (
            reports.map((r: any) => (
              <ReportCard
                key={r.id}
                report={r}
                onResolve={markResolved}
                onConfirm={confirmCorrection}
                onRevert={revertCorrection}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DailyReportCard({ dr }: { dr: any }) {
  const dateStr = format(new Date(dr.report_date), "EEEE d MMMM", { locale: fr });
  const kindLabel = dr.kind === "morning" ? "Matin (7h)" : "Soir (19h)";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
          <span className="capitalize">
            {dateStr} — {kindLabel}
          </span>
          <div className="flex gap-2">
            <Badge variant="outline">{dr.total_reports} signalement(s)</Badge>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> {dr.auto_applied} auto
            </Badge>
            {dr.pending_validation > 0 && (
              <Badge variant="destructive">{dr.pending_validation} à valider</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {dr.summary?.by_type && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(dr.summary.by_type).map(([k, v]: any) => (
              <Badge key={k} variant="outline">
                {PROBLEM_TYPE_LABELS[k]?.label ?? k} : {v}
              </Badge>
            ))}
          </div>
        )}
        {Array.isArray(dr.summary?.sample) && dr.summary.sample.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Échantillon
            </p>
            <ul className="space-y-1 text-sm list-disc pl-5">
              {dr.summary.sample.map((s: any, i: number) => (
                <li key={i}>
                  {s.problem}{" "}
                  {s.auto_applied && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      corrigé
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportCard({
  report,
  onResolve,
  onConfirm,
  onRevert,
}: {
  report: any;
  onResolve: (id: string) => void;
  onConfirm: (id: string) => void;
  onRevert: (r: any) => void;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [loadingImg, setLoadingImg] = useState(false);

  const loadImage = async () => {
    if (imgUrl || !report.screenshot_path) return;
    setLoadingImg(true);
    try {
      const { data, error } = await supabase.storage
        .from("exercise-reports")
        .createSignedUrl(report.screenshot_path, 60 * 60);
      if (error || !data?.signedUrl) setImgError(true);
      else setImgUrl(data.signedUrl);
    } finally {
      setLoadingImg(false);
    }
  };

  const eleveLabel = report.eleve
    ? `${report.eleve.prenom ?? ""} ${report.eleve.nom ?? ""}`.trim() ||
      report.eleve.email
    : "Élève";

  const ai = report.ai_analysis;
  const ptype = report.ai_problem_type
    ? PROBLEM_TYPE_LABELS[report.ai_problem_type]
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              {eleveLabel}
              <Badge variant="outline">{report.context}</Badge>
              {report.item_index != null && (
                <Badge variant="secondary">Question #{report.item_index + 1}</Badge>
              )}
              {ptype && <Badge variant={ptype.variant}>{ptype.label}</Badge>}
              {report.ai_auto_applied && (
                <Badge className="gap-1 bg-green-600 hover:bg-green-700">
                  <Sparkles className="h-3 w-3" /> Corrigé auto
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(report.created_at), "PPP 'à' HH:mm", { locale: fr })}
            </p>
          </div>
          <Badge variant={report.status === "resolu" ? "default" : "destructive"}>
            {STATUS_LABELS[report.status] ?? report.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {report.comment ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
            <span className="font-medium">Élève : </span>
            {report.comment}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Aucun commentaire — analyse uniquement basée sur la capture.
          </p>
        )}

        {ai && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Analyse IA
              {report.ai_confidence != null && (
                <Badge variant="outline" className="ml-auto">
                  Confiance {(report.ai_confidence * 100).toFixed(0)}%
                </Badge>
              )}
            </div>
            <p className="text-sm">
              <span className="font-medium">Problème : </span>
              {ai.problem_description}
            </p>
            <p className="text-sm">
              <span className="font-medium">Solution : </span>
              {ai.proposed_solution_text}
            </p>
            {report.ai_auto_applied && (
              <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Correction appliquée
                automatiquement le{" "}
                {report.ai_applied_at &&
                  format(new Date(report.ai_applied_at), "PPP 'à' HH:mm", {
                    locale: fr,
                  })}
              </p>
            )}
          </div>
        )}

        {!ai && !report.ai_processed_at && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> En attente d'analyse IA…
          </div>
        )}

        {report.screenshot_path && (
          <div className="space-y-2">
            {!imgUrl && !imgError && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadImage}
                disabled={loadingImg}
              >
                {loadingImg ? "Chargement…" : "Afficher la capture d'écran"}
              </Button>
            )}
            {imgError && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <ImageOff className="h-4 w-4" /> Capture indisponible
              </div>
            )}
            {imgUrl && (
              <a href={imgUrl} target="_blank" rel="noreferrer" className="block">
                <img
                  src={imgUrl}
                  alt="Capture du signalement"
                  className="max-h-96 w-full object-contain rounded-md border bg-background"
                />
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
                  <ExternalLink className="h-3 w-3" /> Ouvrir en grand
                </span>
              </a>
            )}
          </div>
        )}

        {report.status !== "resolu" && (
          <div className="flex justify-end pt-2 gap-2 flex-wrap">
            {report.ai_auto_applied && report.formateur_decision !== "reverted" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRevert(report)}
                className="gap-2"
              >
                <Undo2 className="h-4 w-4" /> Annuler la correction
              </Button>
            )}
            {report.ai_auto_applied ? (
              <Button
                size="sm"
                onClick={() => onConfirm(report.id)}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Confirmer la correction
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => onResolve(report.id)}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Marquer comme résolu
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
