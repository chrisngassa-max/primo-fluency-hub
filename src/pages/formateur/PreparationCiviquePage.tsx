import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Landmark, Users, User, Construction, BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CIVIQUE_THEMES } from "@/lib/civiqueThemes";

const PreparationCiviquePage = () => {
  const { user } = useAuth();
  const [groupId, setGroupId] = useState("");
  const [eleveId, setEleveId] = useState("");

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ["preparation-civique-groups", user?.id],
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

  const { data: eleves = [], isLoading: loadingEleves } = useQuery({
    queryKey: ["preparation-civique-eleves", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("eleve_id, profiles!group_members_eleve_id_fkey(id, nom, prenom)")
        .eq("group_id", groupId);
      if (error) throw error;
      return (data ?? []).map((m) => {
        const p = m.profiles as { id: string; nom: string; prenom: string } | null;
        return {
          id: m.eleve_id,
          nom: p ? `${p.prenom} ${p.nom}`.trim() : "Élève",
        };
      });
    },
    enabled: !!groupId,
  });

  const selectedEleve = eleves.find((e) => e.id === eleveId);

  const handleGroupChange = (value: string) => {
    setGroupId(value);
    setEleveId("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          to="/formateur/preparation-examen"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour au hub
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Landmark className="h-7 w-7 text-primary" />
          Parcours Civique
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Préparation à l'examen civique (naturalisation et titres de séjour) — indicateur séparé de l'IPE Langue.
        </p>
      </div>

      <Alert>
        <Construction className="h-4 w-4" />
        <AlertTitle>Module en construction</AlertTitle>
        <AlertDescription>
          Les QCM d'entraînement et l'IPE Civique seront disponibles prochainement. Les thèmes officiels sont
          listés ci-dessous pour orienter la préparation.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Sélection groupe / élève
          </CardTitle>
          <CardDescription>
            Choisissez un groupe puis un élève pour consulter sa préparation civique (scores à venir en v2).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingGroups ? (
            <Skeleton className="h-10 max-w-md" />
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucun groupe actif. Créez un groupe pour suivre la préparation civique.
            </p>
          ) : (
            <>
              <div className="max-w-md space-y-2">
                <p className="text-sm font-medium">1. Choisir un groupe</p>
                <Select value={groupId} onValueChange={handleGroupChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un groupe…" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nom}
                        {g.niveau ? ` — Niveau ${g.niveau}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {groupId && (
                <div className="max-w-md space-y-2">
                  <p className="text-sm font-medium">2. Choisir un élève</p>
                  {loadingEleves ? (
                    <Skeleton className="h-10" />
                  ) : eleves.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun élève dans ce groupe.</p>
                  ) : (
                    <Select value={eleveId} onValueChange={setEleveId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un élève…" />
                      </SelectTrigger>
                      <SelectContent>
                        {eleves.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {selectedEleve && (
                <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {selectedEleve.nom}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold text-muted-foreground tabular-nums">—</span>
                    <span className="text-sm text-muted-foreground">IPE Civique / 100 (bientôt disponible)</span>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Thèmes officiels de l'examen civique
          </CardTitle>
          <CardDescription>
            5 thèmes réglementaires — 40 questions, 45 minutes, 32 bonnes réponses requises.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {CIVIQUE_THEMES.map((theme, i) => (
              <div
                key={theme.id}
                className="rounded-lg border p-4 space-y-1.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{theme.titre}</p>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    Thème {i + 1}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{theme.description}</p>
                <Badge variant="secondary" className="text-xs mt-1">
                  QCM bientôt disponibles
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PreparationCiviquePage;
