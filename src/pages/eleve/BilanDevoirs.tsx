import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, BookOpen, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const BilanDevoirs = () => {
  const { bilanId } = useParams<{ bilanId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: bilan, isLoading } = useQuery({
    queryKey: ["bilan-devoirs-eleve", bilanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bilan_post_devoirs")
        .select("*, session:sessions(titre, date_seance)")
        .eq("id", bilanId!)
        .eq("eleve_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!bilanId && !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!bilan) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-muted-foreground">Bilan introuvable.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/eleve/devoirs")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Retour
        </Button>
      </div>
    );
  }

  const analyse = bilan.analyse_data as any;
  const bilanEleve = analyse?.bilan_eleve;
  const sessionTitle = (bilan as any).session?.titre || "Séance";
  const sessionDate = (bilan as any).session?.date_seance
    ? format(new Date((bilan as any).session.date_seance), "d MMMM yyyy", { locale: fr })
    : "";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/eleve/devoirs")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div>
          <h1 className="text-xl font-bold">Bilan de tes devoirs</h1>
          <p className="text-sm text-muted-foreground">{sessionTitle} · {sessionDate}</p>
        </div>
      </div>

      {bilanEleve ? (
        <>
          {/* Score */}
          <Card className="text-center border-primary/20">
            <CardContent className="pt-6 pb-4">
              <p className="text-4xl font-black text-primary">{bilanEleve.score_global}</p>
              <p className="text-sm text-muted-foreground mt-2">{bilanEleve.message_encouragement}</p>
            </CardContent>
          </Card>

          {/* Réussites */}
          {bilanEleve.reussites?.length > 0 && (
            <Card className="border-green-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />Ce que tu as réussi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bilanEleve.reussites.map((r: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>{r}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* À travailler */}
          {bilanEleve.a_travailler?.length > 0 && (
            <Card className="border-orange-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="h-5 w-5" />Ce qu'il faut encore travailler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bilanEleve.a_travailler.map((a: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                    <span>{a}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Button className="w-full gap-2" onClick={() => navigate("/eleve/devoirs")}>
            <BookOpen className="h-4 w-4" />Voir mes prochains devoirs
          </Button>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            Le bilan n'a pas pu être généré. Contactez votre formateur.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BilanDevoirs;
