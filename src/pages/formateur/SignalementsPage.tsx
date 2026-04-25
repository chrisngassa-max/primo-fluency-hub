import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Flag, CheckCircle2, ExternalLink, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  resolu: "Résolu",
};

export default function SignalementsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"nouveau" | "resolu">("nouveau");

  const { data: reports, isLoading } = useQuery({
    queryKey: ["exercise-reports", user?.id, tab],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_reports")
        .select("*, eleve:profiles!exercise_reports_eleve_id_fkey(prenom, nom, email)")
        .eq("formateur_id", user!.id)
        .in("status", tab === "nouveau" ? ["nouveau", "en_cours"] : ["resolu"])
        .order("created_at", { ascending: false });
      if (error) {
        // fallback sans join si la FK n'est pas reconnue
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

  const markResolved = async (id: string) => {
    const { error } = await supabase
      .from("exercise_reports")
      .update({ status: "resolu", resolved_at: new Date().toISOString(), resolved_by: user!.id })
      .eq("id", id);
    if (error) {
      toast.error("Échec de la mise à jour");
      return;
    }
    toast.success("Signalement résolu");
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
          Problèmes remontés par les élèves (audio, visuel, mauvaise réponse, etc.). Les exercices signalés ne comptent pas dans leur bilan.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="nouveau">À traiter</TabsTrigger>
          <TabsTrigger value="resolu">Résolus</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-4 mt-4">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !reports || reports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucun signalement {tab === "nouveau" ? "à traiter" : "résolu"}.
              </CardContent>
            </Card>
          ) : (
            reports.map((r: any) => <ReportCard key={r.id} report={r} onResolve={markResolved} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportCard({ report, onResolve }: { report: any; onResolve: (id: string) => void }) {
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
      if (error || !data?.signedUrl) {
        setImgError(true);
      } else {
        setImgUrl(data.signedUrl);
      }
    } finally {
      setLoadingImg(false);
    }
  };

  const eleveLabel = report.eleve
    ? `${report.eleve.prenom ?? ""} ${report.eleve.nom ?? ""}`.trim() || report.eleve.email
    : "Élève";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {eleveLabel}
              <Badge variant="outline">{report.context}</Badge>
              {report.item_index != null && (
                <Badge variant="secondary">Question #{report.item_index + 1}</Badge>
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
            {report.comment}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Aucun commentaire fourni.</p>
        )}

        {report.screenshot_path && (
          <div className="space-y-2">
            {!imgUrl && !imgError && (
              <Button variant="outline" size="sm" onClick={loadImage} disabled={loadingImg}>
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
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => onResolve(report.id)} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Marquer comme résolu
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
