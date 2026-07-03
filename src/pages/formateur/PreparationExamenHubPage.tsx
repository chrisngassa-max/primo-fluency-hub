import { Link } from "react-router-dom";
import { GraduationCap, ChevronRight, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PreparationExamenHubPage = () => {
  const { user } = useAuth();

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["preparation-examen-groups", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, nom, niveau")
        .eq("formateur_id", user!.id)
        .eq("is_active", true)
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          Préparation examen (IPE)
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Indicateur de préparation à l'examen TCF IRN — réservé au formateur.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Aucun groupe actif. Créez un groupe pour accéder aux fiches IPE.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {groups.map((g) => (
            <Link key={g.id} to={`/formateur/preparation-examen/groupe/${g.id}`}>
              <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {g.nom}
                      </CardTitle>
                      {g.niveau && (
                        <CardDescription className="mt-0.5">Niveau {g.niveau}</CardDescription>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default PreparationExamenHubPage;
