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
        <h1 className="text-2xl font-bold text-foreground">Mes devoirs</h1>
        <p className="text-muted-foreground mt-1">
          {pendingAll.length === 0 ? "Aucun devoir en attente" : pendingAll.length === 1 ? "1 devoir en attente" : `${pendingAll.length} devoirs en attente`}
        </p>
      </div>

      {/* Stats */}
      {all.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold text-orange-600">{todo.length}</p>
              <p className="text-sm text-muted-foreground">À faire</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold text-blue-600">{inProgress.length}</p>
              <p className="text-sm text-muted-foreground">En cours</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold text-green-600">{completed.length}</p>
              <p className="text-sm text-muted-foreground">Terminés</p>
            </CardContent>
          </Card>
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
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">Pas encore de devoirs</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Tes devoirs apparaîtront ici après ta première séance.
                </p>
              </CardContent>
            </Card>
          )}
          {all.length > 0 && pendingAll.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-3" />
                <p className="text-muted-foreground font-medium">Aucun devoir en attente</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Tous tes devoirs sont à jour. Bravo !
                </p>
              </CardContent>
            </Card>
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
    <Card
      className={cn(
        "cursor-pointer hover:bg-muted/30 transition-colors",
        isDone && "opacity-70",
      )}
      onClick={onOpen}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center h-10 w-10 rounded-xl shrink-0",
            isDone ? "bg-green-100 dark:bg-green-900/30"
              : inProgress ? "bg-blue-100 dark:bg-blue-900/30"
              : isUrgent ? "bg-destructive/10"
              : "bg-orange-100 dark:bg-orange-900/30"
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
              <span className="font-semibold truncate">{ex?.titre || "Exercice"}</span>
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
        </div>
      </CardContent>
    </Card>
  );
}

export default EleveDevoirs;
