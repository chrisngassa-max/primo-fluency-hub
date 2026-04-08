import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, BookOpen, Target, AlertTriangle, ArrowRight, Loader2, Sparkles, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import VigilanceDrawer from "@/components/VigilanceDrawer";

const COMP_COLORS: Record<string, string> = {
  CO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  EE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  EO: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

interface NextSessionCardProps {
  groupId: string;
  groupName: string;
}

export default function NextSessionCard({ groupId, groupName }: NextSessionCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedComps, setSelectedComps] = useState<string[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);

  // Fetch next planned seance from parcours for this group
  const { data: nextSeance, isLoading } = useQuery({
    queryKey: ["next-parcours-seance", groupId],
    queryFn: async () => {
      // Find parcours for this group
      const { data: parcours } = await supabase
        .from("parcours")
        .select("id, niveau_depart, niveau_cible, type_demarche")
        .eq("group_id", groupId)
        .limit(1)
        .maybeSingle();

      if (!parcours) return null;

      // Find first "prevu" seance
      const { data: seance } = await supabase
        .from("parcours_seances")
        .select("*")
        .eq("parcours_id", parcours.id)
        .eq("statut", "prevu")
        .order("ordre", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!seance) return null;

      // Check if a session already exists for this seance
      if (seance.session_id) {
        // Check if it has exercises
        const { count } = await supabase
          .from("session_exercices")
          .select("id", { count: "exact", head: true })
          .eq("session_id", seance.session_id);
        if ((count ?? 0) > 0) return { ...seance, parcours, alreadyGenerated: true };
      }

      return { ...seance, parcours, alreadyGenerated: false };
    },
    enabled: !!groupId,
  });

  // Parse notes JSON
  const notes = useMemo(() => {
    if (!nextSeance?.notes) return null;
    try {
      return typeof nextSeance.notes === "string" ? JSON.parse(nextSeance.notes) : nextSeance.notes;
    } catch {
      return null;
    }
  }, [nextSeance]);

  // Initialize selected competences from the seance
  const competences = nextSeance?.competences_cibles || [];
  const effectiveComps = selectedComps ?? competences;

  const toggleComp = (comp: string) => {
    const current = effectiveComps;
    if (current.includes(comp)) {
      setSelectedComps(current.filter((c: string) => c !== comp));
    } else {
      setSelectedComps([...current, comp]);
    }
  };

  // Handle preparation
  const handlePrepare = async () => {
    if (!nextSeance || !user || effectiveComps.length === 0) {
      toast.warning("Sélectionnez au moins une compétence.");
      return;
    }

    setGenerating(true);
    setGenProgress(0);

    try {
      // 1. Create a session if none exists
      let sessionId = nextSeance.session_id;
      if (!sessionId) {
        const { data: newSession, error: sessErr } = await supabase
          .from("sessions")
          .insert({
            group_id: groupId,
            titre: `S${nextSeance.ordre} : ${nextSeance.titre}`,
            date_seance: new Date().toISOString(),
            niveau_cible: nextSeance.parcours?.niveau_cible || "A1",
            objectifs: nextSeance.objectif_principal || "",
            competences_cibles: effectiveComps,
            duree_minutes: nextSeance.duree_minutes || 180,
          })
          .select("id")
          .single();

        if (sessErr) throw sessErr;
        sessionId = newSession.id;

        // Link parcours_seance to this session
        await supabase
          .from("parcours_seances")
          .update({ session_id: sessionId })
          .eq("id", nextSeance.id);
      }

      setGenProgress(5);

      // 2. Call generate-exercises per competence and save exercises
      const { data: defaultPoint } = await supabase
        .from("points_a_maitriser")
        .select("id")
        .limit(1)
        .single();

      if (!defaultPoint) {
        toast.error("Aucun point à maîtriser trouvé.");
        return;
      }

      const count = 15;
      const distribution = distributeExercises(effectiveComps, count);
      let totalGenerated = 0;
      const allExerciseIds: string[] = [];

      for (const [comp, compCount] of Object.entries(distribution)) {
        setGenProgress(Math.round((totalGenerated / count) * 90) + 5);

        const { data: result, error: genErr } = await supabase.functions.invoke("generate-exercises", {
          body: {
            pointName: nextSeance.objectif_principal || nextSeance.titre,
            competence: comp,
            niveauVise: nextSeance.parcours?.niveau_cible || "A1",
            count: compCount,
            difficultyLevel: 5,
            type_demarche: nextSeance.parcours?.type_demarche || "titre_sejour",
            niveau_depart: nextSeance.parcours?.niveau_depart || "A0",
            niveau_arrivee: nextSeance.parcours?.niveau_cible || "A1",
            groupId,
            gabaritNumero: nextSeance.ordre,
          },
        });

        if (genErr) throw genErr;

        // Save exercises to DB
        const exercises = result?.exercises || [];
        for (const ex of exercises) {
          const { data: saved, error: saveErr } = await supabase
            .from("exercices")
            .insert({
              titre: ex.titre,
              consigne: ex.consigne,
              format: ex.format || "qcm",
              competence: comp as any,
              difficulte: ex.difficulte || 5,
              niveau_vise: nextSeance.parcours?.niveau_cible || "A1",
              contenu: ex.contenu || {},
              animation_guide: ex.animation_guide || null,
              variante_niveau_bas: ex.variante_niveau_bas || null,
              variante_niveau_haut: ex.variante_niveau_haut || null,
              formateur_id: user.id,
              point_a_maitriser_id: defaultPoint.id,
              is_ai_generated: true,
              collectif: true,
              mode: "en_ligne" as any,
            })
            .select("id")
            .single();

          if (saveErr) {
            console.error("Save exercise error:", saveErr);
            continue;
          }
          if (saved) allExerciseIds.push(saved.id);
        }

        totalGenerated += compCount;
        setGenProgress(Math.round((totalGenerated / count) * 90) + 5);
      }

      // 3. Link exercises to session
      if (allExerciseIds.length > 0) {
        const links = allExerciseIds.map((exId: string, i: number) => ({
          session_id: sessionId,
          exercice_id: exId,
          ordre: i + 1,
        }));
        const { error: linkErr } = await supabase.from("session_exercices").insert(links);
        if (linkErr) throw linkErr;
      }

      setGenProgress(100);

      // Invalidate queries
      qc.invalidateQueries({ queryKey: ["next-parcours-seance", groupId] });
      qc.invalidateQueries({ queryKey: ["kpi-sessions"] });
      qc.invalidateQueries({ queryKey: ["session-exercices"] });

      toast.success(`${allExerciseIds.length} exercices générés pour S${nextSeance.ordre} !`);

      // Navigate to session pilot
      setTimeout(() => {
        navigate(`/formateur/seances/${sessionId}/pilote`);
      }, 500);
    } catch (err: any) {
      console.error("Preparation error:", err);
      toast.error("Erreur de préparation", { description: err.message });
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!nextSeance) return null;

  if (nextSeance.alreadyGenerated) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50/20 dark:bg-green-950/10">
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-green-700 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-sm">S{nextSeance.ordre} — {nextSeance.titre}</p>
                <p className="text-xs text-muted-foreground">{groupName} · Séance déjà préparée</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate(`/formateur/seances/${nextSeance.session_id}/pilote`)}>
              Voir la séance <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Prochaine séance — {groupName}
            </CardTitle>
            <CardDescription className="mt-1">
              S{nextSeance.ordre} · {nextSeance.titre}
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">{nextSeance.duree_minutes || 90} min</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Objectif */}
        {nextSeance.objectif_principal && (
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Objectif : </span>
            {nextSeance.objectif_principal}
          </div>
        )}

        {/* Themes */}
        {notes?.themes && notes.themes.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground">Thèmes :</span>
            {notes.themes.map((t: string) => (
              <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
            ))}
          </div>
        )}

        {/* Competences toggles */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground">Compétences visées :</span>
          <div className="flex gap-2 flex-wrap">
            {["CO", "CE", "EE", "EO"].map((comp) => {
              const isSelected = effectiveComps.includes(comp);
              return (
                <button
                  key={comp}
                  onClick={() => toggleComp(comp)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                    isSelected
                      ? COMP_COLORS[comp] + " border-current"
                      : "bg-muted/50 text-muted-foreground border-transparent opacity-50"
                  )}
                >
                  <Checkbox checked={isSelected} className="h-3.5 w-3.5 pointer-events-none" />
                  {comp}
                </button>
              );
            })}
          </div>
        </div>

        {/* Point de vigilance */}
        {notes?.point_vigilance && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
            <p className="text-xs text-orange-700 dark:text-orange-400">{notes.point_vigilance}</p>
          </div>
        )}

        {/* Generation progress */}
        {generating && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Génération en cours... {Math.round(genProgress * 15 / 100)}/15 exercices
            </div>
            <Progress value={genProgress} className="h-2" />
          </div>
        )}

        {/* Action button */}
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={handlePrepare}
          disabled={generating || effectiveComps.length === 0}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Préparation en cours...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Préparer cette séance →
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function distributeExercises(competences: string[], total: number): Record<string, number> {
  if (competences.length === 0) return {};
  const base = Math.floor(total / competences.length);
  const remainder = total % competences.length;
  const result: Record<string, number> = {};
  competences.forEach((comp, i) => {
    result[comp] = base + (i < remainder ? 1 : 0);
  });
  return result;
}
