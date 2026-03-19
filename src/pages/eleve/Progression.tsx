import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, BookOpen, Award } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import CompetenceLabel from "@/components/CompetenceLabel";

const COMPETENCES = ["CO", "CE", "EE", "EO"] as const;

const statutLabel: Record<string, { label: string; color: string }> = {
  non_evalue: { label: "Non évalué", color: "bg-muted text-muted-foreground" },
  non_acquis: { label: "À retravailler", color: "bg-destructive/10 text-destructive" },
  consolide: { label: "En consolidation", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  acquis_provisoire: { label: "Acquis", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-orange-600 dark:text-orange-400";
  return "text-destructive";
}

function scoreBadge(score: number) {
  if (score >= 80) return { label: "Acquis", variant: "default" as const, className: "bg-green-600 hover:bg-green-700" };
  if (score >= 60) return { label: "En cours", variant: "outline" as const, className: "border-orange-400 text-orange-600" };
  return { label: "À retravailler", variant: "destructive" as const, className: "" };
}

interface EleveProgressionProps {
  eleveId?: string; // if provided, formateur is viewing a student
}

const EleveProgression = ({ eleveId }: EleveProgressionProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const targetId = eleveId || user?.id;

  // Fetch competency status
  const { data: competencies, isLoading: compLoading } = useQuery({
    queryKey: ["competency-status", targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_competency_status")
        .select("*")
        .eq("eleve_id", targetId!);
      if (error) throw error;
      return data;
    },
    enabled: !!targetId,
  });

  // Fetch profil_eleve
  const { data: profil, isLoading: profilLoading } = useQuery({
    queryKey: ["profil-eleve", targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profils_eleves")
        .select("*")
        .eq("eleve_id", targetId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!targetId,
  });

  // Fetch recent results with exercise info
  const { data: resultats, isLoading: resLoading } = useQuery({
    queryKey: ["eleve-resultats", targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resultats")
        .select("*, exercice:exercices(titre, competence, format)")
        .eq("eleve_id", targetId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!targetId,
  });

  // Fetch student profile info
  const { data: studentProfile } = useQuery({
    queryKey: ["student-profile-info", targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("prenom, nom")
        .eq("id", targetId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!targetId && !!eleveId,
  });

  const isLoading = compLoading || profilLoading || resLoading;

  // Build competency map
  const compMap: Record<string, string> = {};
  (competencies ?? []).forEach((c) => {
    compMap[c.competence] = c.statut;
  });

  // Build radar data
  const radarData = COMPETENCES.map((comp) => {
    const statut = compMap[comp] || "non_evalue";
    const value = statut === "acquis_provisoire" ? 100 : statut === "consolide" ? 70 : statut === "non_acquis" ? 30 : 0;
    return { competence: comp, value, fullMark: 100 };
  });

  const hasRadarData = radarData.some((d) => d.value > 0);

  // Global progress: compute from profil or average competencies
  const globalProgress = profil?.taux_reussite_global ?? 0;
  const niveauActuel = profil?.niveau_actuel ?? "A0";

  // Determine target level
  const niveauTarget = niveauActuel === "A0" ? "A1" : niveauActuel === "A1" ? "A2" : "B1";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          {eleveId && studentProfile
            ? `Progression de ${studentProfile.prenom} ${studentProfile.nom}`
            : "Ma progression"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suivi de votre parcours vers le TCF IRN
        </p>
      </div>

      {/* Global progress bar */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <span className="font-semibold">Niveau actuel</span>
            </div>
            <Badge variant="outline" className="text-base px-3 py-1 font-bold">
              {niveauActuel}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{niveauActuel}</span>
              <span>Objectif : {niveauTarget}</span>
            </div>
            <Progress value={globalProgress} className={cn("h-4", globalProgress === 0 && "[&>div]:bg-muted")} />
            <p className="text-xs text-muted-foreground text-center">
              {globalProgress > 0
                ? `${Math.round(globalProgress)}% de progression globale`
                : (
                  <Button
                    variant="link"
                    className="text-xs p-0 h-auto text-primary underline"
                    onClick={() => navigate("/eleve/test")}
                  >
                    Passez le test d'entrée pour évaluer votre niveau !
                  </Button>
                )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Competency radar + badges */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Compétences TCF
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Radar chart or empty message */}
            {hasRadarData ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="competence"
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 14, fontWeight: 600 }}
                    />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Niveau"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 w-full flex flex-col items-center justify-center text-center p-4">
                <TrendingUp className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">
                  Votre progression s'affichera ici après votre test d'entrée.
                </p>
              </div>
            )}

            {/* Competency badges */}
            <div className="space-y-3">
              {COMPETENCES.map((comp) => {
                const statut = compMap[comp] || "non_evalue";
                const info = statutLabel[statut] || statutLabel.non_evalue;
                return (
                  <div key={comp} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <CompetenceLabel code={comp} className="font-semibold text-sm cursor-help" />
                      <CompetenceLabel code={comp} showFull className="block text-xs text-muted-foreground" />
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${info.color}`}>
                      {info.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Historique des exercices</CardTitle>
        </CardHeader>
        <CardContent>
          {(!resultats || resultats.length === 0) ? (
            <div className="text-center py-8">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground text-sm">Aucun exercice réalisé pour le moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Exercice</th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">Compétence</th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">Score</th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {resultats.map((r: any) => {
                    const badge = scoreBadge(r.score);
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-2.5 px-2 text-muted-foreground whitespace-nowrap">
                          {format(new Date(r.created_at), "dd MMM", { locale: fr })}
                        </td>
                        <td className="py-2.5 px-2 font-medium max-w-[200px] truncate">
                          {r.exercice?.titre || "Exercice"}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <Badge variant="outline" className="text-xs">
                            <CompetenceLabel code={r.exercice?.competence || "—"} />
                          </Badge>
                        </td>
                        <td className={`py-2.5 px-2 text-center font-bold ${scoreColor(r.score)}`}>
                          {Math.round(r.score)}%
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <Badge variant={badge.variant} className={`text-xs ${badge.className}`}>
                            {badge.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EleveProgression;
