import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { getProfilLabel } from "@/lib/testPositionnement";
import { Eye, Users } from "lucide-react";

const TestResultats = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ["formateur-test-resultats", user?.id],
    queryFn: async () => {
      // Get all students' results via test_resultats_apprenants
      const { data, error } = await supabase
        .from("test_resultats_apprenants")
        .select("*, profiles:apprenant_id(nom, prenom, email)")
        .order("date_test", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const handleConfirmGroupe = async (
    resultId: string,
    sessionId: string,
    groupe: string
  ) => {
    const { error: e1 } = await supabase
      .from("test_resultats_apprenants")
      .update({ groupe_confirme: groupe })
      .eq("id", resultId);
    const { error: e2 } = await supabase
      .from("test_sessions")
      .update({ groupe_valide_par_formateur: groupe })
      .eq("id", sessionId);
    if (e1 || e2) {
      toast({
        title: "Erreur",
        description: "Impossible de confirmer le groupe.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Groupe confirmé" });
      refetch();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const profilBadgeVariant = (profil: string | null) => {
    if (!profil) return "outline" as const;
    if (profil === "A1_maitrise") return "default" as const;
    return "secondary" as const;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Résultats du test de positionnement</h1>
        <Button
          variant="outline"
          onClick={() => navigate("/formateur/test-resultats/groupes")}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Vue groupes
        </Button>
      </div>

      {!results?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucun résultat de test de positionnement pour le moment.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apprenant</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-center">CO</TableHead>
                <TableHead className="text-center">CE</TableHead>
                <TableHead className="text-center">EO</TableHead>
                <TableHead className="text-center">EE</TableHead>
                <TableHead>Profil</TableHead>
                <TableHead>Groupe suggéré</TableHead>
                <TableHead>Groupe confirmé</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.profiles?.prenom} {r.profiles?.nom}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.date_test
                      ? new Date(r.date_test).toLocaleDateString("fr-FR")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">{r.score_co ?? 0}</TableCell>
                  <TableCell className="text-center">{r.score_ce ?? 0}</TableCell>
                  <TableCell className="text-center">{r.score_eo ?? 0}</TableCell>
                  <TableCell className="text-center">{r.score_ee ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={profilBadgeVariant(r.profil)}>
                      {r.profil ? getProfilLabel(r.profil) : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {r.groupe_suggere === "groupe_1"
                        ? "Groupe 1"
                        : r.groupe_suggere === "groupe_2"
                        ? "Groupe 2"
                        : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.groupe_confirme ?? ""}
                      onValueChange={(v) =>
                        handleConfirmGroupe(r.id, r.session_id, v)
                      }
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue placeholder="Choisir…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="groupe_1">Groupe 1</SelectItem>
                        <SelectItem value="groupe_2">Groupe 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        navigate(
                          `/formateur/test-resultats/${r.apprenant_id}`
                        )
                      }
                      className="gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      Détail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default TestResultats;
