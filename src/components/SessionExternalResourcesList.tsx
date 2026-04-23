import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Trash2, Eye, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ExternalResource {
  id: string;
  title: string;
  url: string;
  embed_type: string;
  provider: string;
  embeddable_result: boolean | null;
  created_at: string;
}

interface ResourceResult {
  id: string;
  external_resource_id: string;
  student_id: string;
  score: number | null;
  difficulty_felt: string | null;
  comment: string | null;
  time_spent_seconds: number | null;
  created_at: string;
  student: { prenom: string; nom: string } | null;
}

interface Props {
  sessionId: string;
}

export default function SessionExternalResourcesList({ sessionId }: Props) {
  const qc = useQueryClient();
  const [returnsOpen, setReturnsOpen] = useState<ExternalResource | null>(null);

  const { data: resources, isLoading } = useQuery({
    queryKey: ["external-resources", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_resources")
        .select("id, title, url, embed_type, provider, embeddable_result, created_at")
        .eq("session_id", sessionId)
        .order("ordre", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ExternalResource[];
    },
  });

  const { data: results } = useQuery({
    queryKey: ["external-resources-results", sessionId, returnsOpen?.id],
    enabled: !!returnsOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_resource_results")
        .select("id, external_resource_id, student_id, score, difficulty_felt, comment, time_spent_seconds, created_at")
        .eq("external_resource_id", returnsOpen!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = Array.from(new Set((data || []).map((r) => r.student_id)));
      let profiles: Record<string, { prenom: string; nom: string }> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, prenom, nom")
          .in("id", ids);
        profiles = Object.fromEntries(
          (profs || []).map((p) => [p.id, { prenom: p.prenom, nom: p.nom }])
        );
      }
      return (data || []).map((r) => ({
        ...r,
        student: profiles[r.student_id] || null,
      })) as ResourceResult[];
    },
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette ressource externe ?")) return;
    const { error } = await supabase.from("external_resources").delete().eq("id", id);
    if (error) {
      toast.error("Suppression impossible");
      return;
    }
    toast.success("Ressource supprimée");
    qc.invalidateQueries({ queryKey: ["external-resources", sessionId] });
  };

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (!resources || resources.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-primary" />
            Ressources externes de la séance
            <Badge variant="secondary">{resources.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {resources.map((r) => {
            const embeddable = r.embed_type === "iframe" && r.embeddable_result !== false;
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{r.title}</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {r.provider}
                    </Badge>
                    <Badge
                      variant={embeddable ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {embeddable ? "Intégrable" : "Lien externe"}
                    </Badge>
                  </div>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary truncate block mt-1"
                  >
                    {r.url}
                  </a>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReturnsOpen(r)}
                    className="gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    Retours
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    title="Ouvrir"
                  >
                    <a href={r.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(r.id)}
                    title="Supprimer"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!returnsOpen} onOpenChange={(o) => !o && setReturnsOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Retours élèves — {returnsOpen?.title}</DialogTitle>
            <DialogDescription>
              {results?.length || 0} retour{(results?.length || 0) > 1 ? "s" : ""} reçu
              {(results?.length || 0) > 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>
          {!results || results.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Aucun retour pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {results.map((r) => (
                <div key={r.id} className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {r.student
                        ? `${r.student.prenom} ${r.student.nom}`
                        : "Élève"}
                    </span>
                    <div className="flex items-center gap-2">
                      {r.score !== null && (
                        <Badge variant="default">{r.score}%</Badge>
                      )}
                      {r.difficulty_felt && (
                        <Badge variant="outline" className="text-xs">
                          {r.difficulty_felt}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {r.time_spent_seconds && (
                    <p className="text-xs text-muted-foreground">
                      Temps : {Math.round(r.time_spent_seconds / 60)} min
                    </p>
                  )}
                  {r.comment && (
                    <p className="text-sm italic text-muted-foreground">
                      « {r.comment} »
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
