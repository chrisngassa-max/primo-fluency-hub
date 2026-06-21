import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays, CheckCircle2, ChevronDown, ChevronUp, GraduationCap, History, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CompetenceLabel from "@/components/CompetenceLabel";
import SeanceLeconsList from "@/components/eleve/SeanceLeconsList";
import { useActiveSeances } from "@/hooks/useEleveSeances";
import { qualitativeProgress } from "@/lib/qualitativeProgress";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type ExerciceFait = { exerciceId: string; titre: string; competence: string | null; score: number };

type SeancePassee = {
  id: string;
  titre: string;
  date_seance: string;
  group_nom: string;
  statut: string;
  nbEnvoyes: number;
  exercicesFaits: ExerciceFait[];
  avgScore: number | null;
  nbLecons: number;
};

const MesSeances = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: activeSeances } = useActiveSeances(user?.id);
  const activeIds = useMemo(
    () => new Set((activeSeances ?? []).map((s) => s.id)),
    [activeSeances],
  );

  const { data: seances, isLoading } = useQuery({
    queryKey: ["eleve-mes-seances", user?.id],
    queryFn: async (): Promise<SeancePassee[]> => {
      // 1) Groupes de l'élève → séances de ces groupes (ancrage persisté).
      const { data: gm } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("eleve_id", user!.id);
      const groupIds = (gm ?? []).map((r) => r.group_id);
      if (groupIds.length === 0) return [];

      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, statut, group:groups(nom)")
        .in("group_id", groupIds)
        .order("date_seance", { ascending: false });
      if (!sessions?.length) return [];
      const sessionIds = sessions.map((s: any) => s.id);

      // 2) Exercices envoyés par séance (persisté).
      const { data: seLinks } = await supabase
        .from("session_exercices")
        .select("session_id, exercice_id, exercice:exercices(id, titre, competence)")
        .in("session_id", sessionIds)
        .eq("statut", "traite_en_classe" as any)
        .or(`eleve_id.is.null,eleve_id.eq.${user!.id}`);

      // 3) Devoirs rattachés à une séance (persisté).
      const { data: devoirs } = await supabase
        .from("devoirs")
        .select("session_id, exercice_id, exercice:exercices(id, titre, competence)")
        .eq("eleve_id", user!.id)
        .not("session_id", "is", null);

      // 4) Tous les résultats de l'élève (score + date).
      const { data: resultats } = await supabase
        .from("resultats")
        .select("exercice_id, score, created_at")
        .eq("eleve_id", user!.id)
        .order("created_at", { ascending: false });
      const scoreByEx = new Map<string, number>();
      (resultats ?? []).forEach((r: any) => {
        if (!scoreByEx.has(r.exercice_id)) scoreByEx.set(r.exercice_id, r.score);
      });

      // 5) Compte des leçons publiées par séance (persisté, révisable).
      const { data: lecons } = await supabase
        .from("ressources_pedagogiques" as any)
        .select("session_id")
        .in("session_id", sessionIds)
        .eq("statut", "published" as any);
      const leconCount = new Map<string, number>();
      (lecons as any[] ?? []).forEach((l: any) => {
        if (l.session_id) leconCount.set(l.session_id, (leconCount.get(l.session_id) ?? 0) + 1);
      });

      // Index : session → exercices (titre/compétence), en dédoublonnant.
      const exBySession = new Map<string, Map<string, { titre: string; competence: string | null }>>();
      const pushEx = (sid: string | null, ex: any) => {
        if (!sid || !ex) return;
        if (!exBySession.has(sid)) exBySession.set(sid, new Map());
        exBySession.get(sid)!.set(ex.id, { titre: ex.titre ?? "Exercice", competence: ex.competence ?? null });
      };
      (seLinks ?? []).forEach((se: any) => pushEx(se.session_id, se.exercice));
      (devoirs ?? []).forEach((d: any) => pushEx(d.session_id, d.exercice));

      const out: SeancePassee[] = [];
      for (const s of sessions as any[]) {
        // « Mes séances » = historique : on exclut les séances actives (du jour / en cours)
        // qui sont déjà affichées dans « Ma séance ».
        if (activeIds.has(s.id)) continue;

        const exMap = exBySession.get(s.id) ?? new Map();
        const nbLecons = leconCount.get(s.id) ?? 0;

        const exercicesFaits: ExerciceFait[] = [];
        exMap.forEach((meta, exId) => {
          if (scoreByEx.has(exId)) {
            exercicesFaits.push({
              exerciceId: exId,
              titre: meta.titre,
              competence: meta.competence,
              score: scoreByEx.get(exId)!,
            });
          }
        });

        // On ne garde que les séances « vécues » : contenu envoyé, fait, ou leçons.
        if (exMap.size === 0 && exercicesFaits.length === 0 && nbLecons === 0) continue;

        const avgScore = exercicesFaits.length
          ? Math.round(exercicesFaits.reduce((a, e) => a + e.score, 0) / exercicesFaits.length)
          : null;

        out.push({
          id: s.id,
          titre: s.titre,
          date_seance: s.date_seance,
          group_nom: s.group?.nom ?? "",
          statut: s.statut,
          nbEnvoyes: exMap.size,
          exercicesFaits,
          avgScore,
          nbLecons,
        });
      }
      return out;
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const list = seances ?? [];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#0b234a]">Mes séances</h1>
        <p className="text-muted-foreground mt-1">
          Retrouve tes séances passées : exercices faits, scores et leçons à réviser.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
            <History className="h-8 w-8 text-orange-600" />
          </div>
          <p className="font-semibold text-foreground">Aucune séance passée</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Tes séances apparaîtront ici une fois terminées. Tu pourras revoir tes exercices et tes leçons.
          </p>
          <Button variant="outline" className="mt-5" onClick={() => navigate("/eleve/ma-seance")}>
            Voir ma séance du jour
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((s) => (
            <SeanceCard
              key={s.id}
              seance={s}
              open={openId === s.id}
              onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function SeanceCard({ seance, open, onToggle }: { seance: SeancePassee; open: boolean; onToggle: () => void }) {
  const acquis = seance.avgScore !== null ? qualitativeProgress(seance.avgScore) : null;

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <button onClick={onToggle} className="w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{format(new Date(seance.date_seance), "EEEE d MMMM yyyy", { locale: fr })}</span>
              </div>
              <p className="font-bold text-[#0b234a] truncate">{seance.titre}</p>
              {seance.group_nom && (
                <p className="text-xs text-muted-foreground mt-0.5">{seance.group_nom}</p>
              )}
            </div>
            {acquis && (
              <Badge className={cn("shrink-0", acquis.className)}>{acquis.shortLabel}</Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge variant="outline" className="text-xs gap-1">
              <CheckCircle2 className="h-3 w-3" /> {seance.exercicesFaits.length} fait{seance.exercicesFaits.length > 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="text-xs gap-1">
              <BookOpen className="h-3 w-3" /> {seance.nbEnvoyes} exercice{seance.nbEnvoyes > 1 ? "s" : ""}
            </Badge>
            {seance.nbLecons > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <GraduationCap className="h-3 w-3" /> {seance.nbLecons} leçon{seance.nbLecons > 1 ? "s" : ""}
              </Badge>
            )}
            <span className="ml-auto inline-flex items-center text-xs font-medium text-primary">
              {open ? (<>Replier <ChevronUp className="h-3.5 w-3.5 ml-0.5" /></>) : (<>Voir le détail <ChevronDown className="h-3.5 w-3.5 ml-0.5" /></>)}
            </span>
          </div>
        </button>

        {open && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {/* Récap / bilan : moyenne de la séance */}
            {acquis && (
              <div className={cn("rounded-lg border p-3 text-center", acquis.borderClassName)}>
                <p className={cn("inline-flex rounded-full px-3 py-1 text-sm font-bold", acquis.className)}>
                  {acquis.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">{acquis.message}</p>
              </div>
            )}

            {/* Exercices faits + scores */}
            {seance.exercicesFaits.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Exercices faits
                </h3>
                {seance.exercicesFaits.map((ex) => {
                  const a = qualitativeProgress(ex.score);
                  return (
                    <div key={ex.exerciceId} className={cn("flex items-center justify-between gap-2 rounded-lg border-l-4 bg-muted/30 px-3 py-2", a.borderClassName)}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{ex.titre}</p>
                        {ex.competence && (
                          <Badge variant="outline" className="text-xs mt-0.5"><CompetenceLabel code={ex.competence} /></Badge>
                        )}
                      </div>
                      <Badge className={cn("shrink-0", a.className)}>{a.shortLabel}</Badge>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Leçons reçues (révisables) */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Leçons reçues
              </h3>
              <SeanceLeconsList sessionIds={[seance.id]} emptyHint="Aucune leçon pour cette séance." />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MesSeances;
