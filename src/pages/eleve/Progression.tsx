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
import { TrendingUp, BookOpen, Award, CalendarCheck, Mail, KeyRound, Copy, Users, ArrowRightLeft, PlusCircle, X, Target } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import CompetenceLabel from "@/components/CompetenceLabel";
import { StudentPacingCard } from "@/components/PacingTracker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const COMPETENCES = ["CO", "CE", "EE", "EO", "Structures"] as const;

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
  const queryClient = useQueryClient();
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
        .select("prenom, nom, email")
        .eq("id", targetId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!targetId && !!eleveId,
  });

  // Fetch attendance stats
  const { data: presenceStats } = useQuery({
    queryKey: ["presence-stats", targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presences")
        .select("present, session_id")
        .eq("eleve_id", targetId!);
      if (error) throw error;
      const total = (data ?? []).length;
      const presents = (data ?? []).filter((p: any) => p.present).length;
      const absents = total - presents;
      const rate = total > 0 ? Math.round((presents / total) * 100) : null;
      return { total, presents, absents, rate };
    },
    enabled: !!targetId,
  });

  // Fetch student's current groups (formateur view)
  const { data: studentGroups } = useQuery({
    queryKey: ["student-groups", targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("id, group_id, groups(id, nom, niveau)")
        .eq("eleve_id", targetId!);
      if (error) throw error;
      return data;
    },
    enabled: !!targetId && !!eleveId,
  });

  // Fetch all formateur groups (for reassignment)
  const { data: allGroups } = useQuery({
    queryKey: ["formateur-groups-for-reassign"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, nom, niveau")
        .eq("is_active", true)
        .order("nom");
      if (error) throw error;
      return data;
    },
    enabled: !!eleveId,
  });

  const handleReassignGroup = async (membershipId: string, newGroupId: string) => {
    const { error } = await supabase
      .from("group_members")
      .update({ group_id: newGroupId })
      .eq("id", membershipId);
    if (error) {
      toast.error("Erreur lors du transfert");
      return;
    }
    toast.success("Élève transféré avec succès");
    queryClient.invalidateQueries({ queryKey: ["student-groups", targetId] });
  };

  const handleAddToGroup = async (groupId: string) => {
    const alreadyIn = (studentGroups ?? []).some((sg: any) => sg.group_id === groupId);
    if (alreadyIn) {
      toast.error("L'élève est déjà dans ce groupe");
      return;
    }
    const { error } = await supabase
      .from("group_members")
      .insert({ eleve_id: targetId!, group_id: groupId });
    if (error) {
      toast.error("Erreur lors de l'ajout");
      return;
    }
    toast.success("Élève ajouté au groupe");
    queryClient.invalidateQueries({ queryKey: ["student-groups", targetId] });
  };

  const handleRemoveFromGroup = async (membershipId: string) => {
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("id", membershipId);
    if (error) {
      toast.error("Erreur lors du retrait");
      return;
    }
    toast.success("Élève retiré du groupe");
    queryClient.invalidateQueries({ queryKey: ["student-groups", targetId] });
  };

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

  // Check test de positionnement completion
  const { data: testPositionnement } = useQuery({
    queryKey: ["eleve-test-positionnement-progression", targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_sessions")
        .select("statut")
        .eq("apprenant_id", targetId!)
        .eq("statut", "termine")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!targetId && !eleveId,
  });

  const testCompleted = !eleveId && testPositionnement?.statut === "termine";

  // Global progress: compute from profil or average competencies
  const globalProgress = profil?.taux_reussite_global ?? 0;
  // Show "Non évalué" until test is completed
  const niveauActuel = (testCompleted || eleveId) ? (profil?.niveau_actuel ?? "A0") : "Non évalué";

  // Determine target level (only meaningful after evaluation)
  const niveauTarget = profil?.niveau_actuel === "A0" ? "A1" : profil?.niveau_actuel === "A1" ? "A2" : "B1";

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
          Suivi de ton parcours vers le TCF IRN
        </p>
      </div>

      {/* 60-hour pacing tracker */}
      {targetId && <StudentPacingCard eleveId={targetId} />}

      {/* Student credentials (formateur view only) */}
      {eleveId && studentProfile && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Identifiants de connexion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">Email :</span>
              <span className="text-muted-foreground">{studentProfile.email}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  navigator.clipboard.writeText(studentProfile.email ?? "");
                  toast.success("Email copié");
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            {studentProfile.mot_de_passe_initial && (
              <div className="flex items-center gap-2 text-sm">
                <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">Mot de passe initial :</span>
                <code className="bg-muted px-2 py-0.5 rounded text-xs">••••••••</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    navigator.clipboard.writeText(studentProfile.mot_de_passe_initial ?? "");
                    toast.success("Mot de passe copié");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
            {!studentProfile.mot_de_passe_initial && (
              <p className="text-xs text-muted-foreground italic">
                Mot de passe initial non disponible (l'élève s'est inscrit lui-même).
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Group management (formateur view only) */}
      {eleveId && studentGroups && allGroups && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Groupes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {studentGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Aucun groupe assigné.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {studentGroups.map((sg: any) => {
                  const group = sg.groups as any;
                  const otherGroups = (allGroups ?? []).filter(
                    (g: any) => g.id !== sg.group_id
                  );
                  return (
                    <DropdownMenu key={sg.id}>
                      <DropdownMenuTrigger asChild>
                        <Badge
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80 gap-1.5 text-sm py-1 px-3"
                        >
                          {group?.nom ?? "Groupe"} — {group?.niveau ?? ""}
                          <ArrowRightLeft className="h-3 w-3 ml-1 opacity-60" />
                        </Badge>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          Transférer vers…
                        </p>
                        <DropdownMenuSeparator />
                        {otherGroups.map((g: any) => (
                          <DropdownMenuItem
                            key={g.id}
                            onClick={() => handleReassignGroup(sg.id, g.id)}
                          >
                            {g.nom} ({g.niveau})
                          </DropdownMenuItem>
                        ))}
                        {otherGroups.length === 0 && (
                          <p className="px-2 py-1.5 text-xs text-muted-foreground">
                            Aucun autre groupe
                          </p>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleRemoveFromGroup(sg.id)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Retirer de ce groupe
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })}
              </div>
            )}

            {/* Add to another group */}
            {(() => {
              const availableGroups = (allGroups ?? []).filter(
                (g: any) => !(studentGroups ?? []).some((sg: any) => sg.group_id === g.id)
              );
              if (availableGroups.length === 0) return null;
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <PlusCircle className="h-3.5 w-3.5" />
                      Ajouter à un groupe
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {availableGroups.map((g: any) => (
                      <DropdownMenuItem
                        key={g.id}
                        onClick={() => handleAddToGroup(g.id)}
                      >
                        {g.nom} ({g.niveau})
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Global progress bar */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <span className="font-semibold">Niveau actuel</span>
            </div>
            <Badge variant="outline" className={cn("text-base px-3 py-1 font-bold", niveauActuel === "Non évalué" && "text-muted-foreground")}>
              {niveauActuel}
            </Badge>
          </div>
          {niveauActuel === "Non évalué" ? (
            <div className="text-center py-2">
              <Button
                variant="link"
                className="text-sm p-0 h-auto text-primary underline"
                onClick={() => navigate("/eleve/test-positionnement")}
              >
                Passe le test d'entrée pour évaluer ton niveau !
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{niveauActuel}</span>
                <span>Objectif : {niveauTarget}</span>
              </div>
              <Progress value={globalProgress} className={cn("h-4", globalProgress === 0 && "[&>div]:bg-muted")} />
              <p className="text-xs text-muted-foreground text-center">
                {globalProgress > 0
                  ? `${Math.round(globalProgress)}% de progression globale`
                  : "Commence les exercices pour voir ta progression !"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance stats */}
      {presenceStats && presenceStats.total > 0 && (
        <Card>
          <CardContent className="pt-6 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck className="h-5 w-5 text-primary" />
              <span className="font-semibold">Assiduité</span>
              <Badge
                variant={presenceStats.rate! >= 80 ? "default" : presenceStats.rate! >= 60 ? "outline" : "destructive"}
                className={cn(
                  "ml-auto",
                  presenceStats.rate! >= 80 && "bg-green-600 hover:bg-green-700"
                )}
              >
                {presenceStats.rate}%
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xl font-bold">{presenceStats.total}</p>
                <p className="text-[11px] text-muted-foreground">Séances</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xl font-bold text-green-600">{presenceStats.presents}</p>
                <p className="text-[11px] text-muted-foreground">Présences</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xl font-bold text-destructive">{presenceStats.absents}</p>
                <p className="text-[11px] text-muted-foreground">Absences</p>
              </div>
            </div>
            <Progress
              value={presenceStats.rate ?? 0}
              className={cn("h-2 mt-3", presenceStats.rate! < 60 && "[&>div]:bg-destructive")}
            />
          </CardContent>
        </Card>
      )}

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
                  Ta progression s'affichera ici après ton test d'entrée.
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

      {/* Objectif TCF IRN */}
      {(() => {
        const demarche = profil?.type_demarche || "titre_sejour";
        const epreuvesRequises: string[] = demarche === "naturalisation"
          ? ["CO", "CE", "EE", "EO"]
          : ["CO", "CE"];
        const epreuvesNonValidees = epreuvesRequises.filter(
          (comp) => compMap[comp] !== "acquis_provisoire"
        );
        const nbRestant = epreuvesNonValidees.length;

        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Ton objectif TCF IRN
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Démarche : <span className="font-medium text-foreground">
                  {demarche === "naturalisation" ? "Naturalisation (B1 requis sur 4 épreuves)" : "Titre de séjour (A2/B1 sur CO + CE)"}
                </span>
              </p>

              {nbRestant === 0 ? (
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium text-sm">
                  <Award className="h-4 w-4" />
                  Toutes les épreuves sont validées — bravo ! 🎉
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Il te reste <span className="text-destructive font-bold">{nbRestant} épreuve{nbRestant > 1 ? "s" : ""}</span> à valider pour atteindre le niveau B1 requis.
                  </p>
                  <div className="space-y-2">
                    {epreuvesRequises.map((comp) => {
                      const statut = compMap[comp] || "non_evalue";
                      const valide = statut === "acquis_provisoire";
                      const info = statutLabel[statut] || statutLabel.non_evalue;
                      return (
                        <div key={comp} className="flex items-center justify-between p-2.5 rounded-lg border">
                          <CompetenceLabel code={comp} showFull className="text-sm font-medium" />
                          {valide ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              ✅ Validé
                            </span>
                          ) : (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                              🔴 {info.label}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })()}

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
