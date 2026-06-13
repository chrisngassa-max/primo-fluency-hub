import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, CheckCircle2, AlertCircle, ChevronRight, AlertTriangle,
  XCircle, Calendar, PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CompetenceLabel from "@/components/CompetenceLabel";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const EleveDevoirs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: devoirs, isLoading } = useQuery({
    queryKey: ["eleve-devoirs-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devoirs")
        .select("*, exercice:exercices(id, titre, competence, consigne, format, contenu)")
        .eq("eleve_id", user!.id)
        // Hide archived from the student
        .neq("statut", "archive" as any)
        .order("date_echeance", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // Helper: a devoir is "in progress" if at least one resultat exists for the eleve
  const { data: tentativeMap } = useQuery({
    queryKey: ["eleve-devoirs-tentatives", user?.id, devoirs?.map((d) => d.id).join(",")],
    queryFn: async () => {
      if (!devoirs || devoirs.length === 0) return {} as Record<string, number>;
      const ids = devoirs.map((d) => d.id);
      const { data } = await supabase
        .from("resultats")
        .select("devoir_id")
        .eq("eleve_id", user!.id)
        .in("devoir_id", ids);
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        if (r.devoir_id) map[r.devoir_id] = (map[r.devoir_id] || 0) + 1;
      });
      return map;
    },
    enabled: !!user?.id && !!devoirs && devoirs.length > 0,
  });

  const all = devoirs ?? [];
  const completed = all.filter((d) => d.statut === "fait" || d.statut === "arrete");
  const pendingAll = all.filter((d) => d.statut === "en_attente" || d.statut === "expire");
  const inProgress = pendingAll.filter((d) => (tentativeMap?.[d.id] ?? 0) > 0);
  const todo = pendingAll.filter((d) => (tentativeMap?.[d.id] ?? 0) === 0);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#0b234a]">Mes devoirs</h1>
        <p className="text-muted-foreground mt-1">
          {pendingAll.length === 0 ? "Aucun devoir en attente" : pendingAll.length === 1 ? "1 devoir en attente" : `${pendingAll.length} devoirs en attente`}
        </p>
      </div>

      {!isLoading && inProgress[0] && (
        <button
          type="button"
          onClick={() => navigate(`/eleve/devoirs/${inProgress[0].id}`)}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-[#0b234a] p-4 text-left text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/65">À continuer</p>
            <p className="mt-1 font-bold">{(inProgress[0].exercice as any)?.titre || "Devoir en cours"}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0" />
        </button>
      )}

      {/* Stats */}
      {all.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[0.625rem] bg-orange-500 p-4 text-center shadow-sm">
            <p className="text-3xl font-extrabold text-white">{todo.length}</p>
            <p className="text-xs font-medium text-white/90 mt-0.5">À faire</p>
          </div>
          <div className="rounded-[0.625rem] bg-blue-500 p-4 text-center shadow-sm">
            <p className="text-3xl font-extrabold text-white">{inProgress.length}</p>
            <p className="text-xs font-medium text-white/90 mt-0.5">En cours</p>
          </div>
          <div className="rounded-[0.625rem] bg-green-500 p-4 text-center shadow-sm">
            <p className="text-3xl font-extrabold text-white">{completed.length}</p>
            <p className="text-xs font-medium text-white/90 mt-0.5">Terminés</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <>
          {/* À faire */}
          {todo.length > 0 && (
            <Section title="À faire" icon={<BookOpen className="h-4 w-4" />}>
              {todo.map((d) => (
                <DevoirCard key={d.id} devoir={d} onOpen={() => navigate(`/eleve/devoirs/${d.id}`)} />
              ))}
            </Section>
          )}

          {/* En cours */}
          {inProgress.length > 0 && (
            <Section title="En cours" icon={<PlayCircle className="h-4 w-4" />}>
              {inProgress.map((d) => (
                <DevoirCard key={d.id} devoir={d} onOpen={() => navigate(`/eleve/devoirs/${d.id}`)} inProgress />
              ))}
            </Section>
          )}

          {/* Terminés */}
          {completed.length > 0 && (
            <Section title="Terminés" icon={<CheckCircle2 className="h-4 w-4" />}>
              {completed.slice(0, 10).map((d) => (
                <DevoirCard key={d.id} devoir={d} onOpen={() => navigate(`/eleve/devoirs/${d.id}`)} />
              ))}
            </Section>
          )}

          {/* Empty states */}
          {all.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <p className="font-semibold text-foreground">Aucun devoir pour l'instant</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tes devoirs apparaîtront ici après ta première séance.
              </p>
            </div>
          )}
          {all.length > 0 && pendingAll.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <p className="font-semibold text-foreground">Tous tes devoirs sont à jour !</p>
              <p className="text-sm text-muted-foreground mt-1">Bravo, continue comme ça.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        {icon}{title}
      </h2>
      {children}
    </div>
  );
}

function DeadlineDisplay({ dateEcheance, isDone }: { dateEcheance: string; isDone: boolean }) {
  if (isDone) return null;

  const deadline = new Date(dateEcheance);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / 86400000);
  const dateStr = format(deadline, "EEEE d MMMM yyyy", { locale: fr });

  // Soft deadline — past dates become "Conseillé pour le …"
  if (daysLeft < 0) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
        <Calendar className="h-3.5 w-3.5" />
        <span>Conseillé pour le {dateStr} — tu peux encore le faire</span>
      </div>
    );
  }

  if (daysLeft <= 2) {
    return (
      <div className="flex items-center gap-1.5 text-orange-600 text-sm mt-1">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>{daysLeft === 0 ? "Conseillé aujourd'hui" : daysLeft === 1 ? "Conseillé demain" : "Conseillé dans 2 jours"}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
      <Calendar className="h-3.5 w-3.5" />
      <span>Conseillé avant le {dateStr}</span>
    </div>
  );
}

function DevoirCard({ devoir, onOpen, inProgress }: { devoir: any; onOpen: () => void; inProgress?: boolean }) {
  const ex = devoir.exercice as any;
  const isUrgent = devoir.raison === "remediation";
  const isDone = devoir.statut === "fait" || devoir.statut === "arrete";

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 p-4 rounded-[0.625rem] border text-left transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isDone ? "bg-green-50 border-green-200 hover:bg-green-100/70 opacity-80"
          : inProgress ? "bg-blue-50 border-blue-200 hover:bg-blue-100/70"
          : isUrgent ? "bg-destructive/5 border-destructive/30 hover:bg-destructive/10"
          : "bg-orange-50 border-orange-200 hover:bg-orange-100/70",
      )}
      onClick={onOpen}
    >
          <div className={cn(
            "flex items-center justify-center h-10 w-10 rounded-xl shrink-0",
            isDone ? "bg-green-100"
              : inProgress ? "bg-blue-100"
              : isUrgent ? "bg-destructive/10"
              : "bg-orange-100"
          )}>
            {isDone ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : inProgress ? (
              <PlayCircle className="h-5 w-5 text-blue-600" />
            ) : isUrgent ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <BookOpen className="h-5 w-5 text-orange-600" />
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">{ex?.titre || "Activité à compléter"}</span>
              {(devoir as any).source_label === "tronc_commun" && !isDone && (
                <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">Exercice du groupe</Badge>
              )}
              {((devoir as any).source_label === "individualise" || (!((devoir as any).source_label) && isUrgent)) && !isDone && (
                <Badge variant="secondary" className="text-xs border-orange-500/30 text-orange-600">Personnalisé</Badge>
              )}
              {inProgress && !isDone && (
                <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-600">En cours</Badge>
              )}
              {isDone && (
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">Terminé</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="text-xs"><CompetenceLabel code={ex?.competence} /></Badge>
            </div>
            <DeadlineDisplay dateEcheance={devoir.date_echeance} isDone={isDone} />
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

export default EleveDevoirs;
