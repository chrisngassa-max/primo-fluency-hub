import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { getProfilLabel } from "@/lib/testPositionnement";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";

const TestResultatGroupes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ["test-resultats-groupes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_resultats_apprenants")
        .select("*, profiles:apprenant_id(nom, prenom)")
        .order("date_test", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const handleMove = async (resultId: string, newGroupe: string) => {
    const { error } = await supabase
      .from("test_resultats_apprenants")
      .update({ groupe_confirme: newGroupe })
      .eq("id", resultId);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de déplacer l'apprenant.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Apprenant déplacé" });
      refetch();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const groupe1 = (results ?? []).filter(
    (r: any) =>
      (r.groupe_confirme ?? r.groupe_suggere) === "groupe_1"
  );
  const groupe2 = (results ?? []).filter(
    (r: any) =>
      (r.groupe_confirme ?? r.groupe_suggere) === "groupe_2"
  );

  const renderStudent = (r: any, targetGroup: string) => (
    <div
      key={r.id}
      className="flex items-center justify-between gap-2 p-3 rounded-lg border"
    >
      <div>
        <p className="font-medium text-sm">
          {r.profiles?.prenom} {r.profiles?.nom}
        </p>
        <Badge variant="outline" className="mt-1 text-xs">
          {r.profil ? getProfilLabel(r.profil) : "—"}
        </Badge>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleMove(r.id, targetGroup)}
        title="Déplacer"
      >
        <ArrowRightLeft className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/formateur/test-resultats")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold">Vue groupes</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Groupe 1
              <Badge variant="secondary" className="ml-auto">
                {groupe1.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {groupe1.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun apprenant
              </p>
            ) : (
              groupe1.map((r: any) => renderStudent(r, "groupe_2"))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Groupe 2
              <Badge variant="secondary" className="ml-auto">
                {groupe2.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {groupe2.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun apprenant
              </p>
            ) : (
              groupe2.map((r: any) => renderStudent(r, "groupe_1"))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestResultatGroupes;
