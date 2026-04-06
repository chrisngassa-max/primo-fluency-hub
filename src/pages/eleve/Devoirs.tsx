import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  BookOpen, CheckCircle2, AlertCircle, Clock, ArrowRight,
  Send, Loader2, ChevronRight, AlertTriangle, XCircle, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CompetenceLabel from "@/components/CompetenceLabel";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const EleveDevoirs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: devoirs, isLoading } = useQuery({
    queryKey: ["eleve-devoirs-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devoirs")
        .select("*, exercice:exercices(id, titre, competence, consigne, format, contenu)")
        .eq("eleve_id", user!.id)
        .order("date_echeance", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const pending = devoirs?.filter((d) => d.statut === "en_attente") ?? [];
  const completed = devoirs?.filter((d) => d.statut === "fait" || d.statut === "arrete") ?? [];
  const expired = devoirs?.filter((d) => d.statut === "expire") ?? [];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mes devoirs</h1>
        <p className="text-muted-foreground mt-1">
          {pending.length === 0 ? "Aucun devoir en attente" : pending.length === 1 ? "1 devoir en attente" : `${pending.length} devoirs en attente`}
        </p>
      </div>

      {/* Stats */}
      {devoirs && devoirs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold text-orange-600">{pending.length}</p>
              <p className="text-sm text-muted-foreground">En attente</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold text-green-600">{completed.length}</p>
              <p className="text-sm text-muted-foreground">Terminés</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold text-destructive">{expired.length}</p>
              <p className="text-sm text-muted-foreground">Expirés</p>
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
      ) : pending.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">À faire</h2>
          {pending.map((d) => (
            <DevoirCard key={d.id} devoir={d} onOpen={() => navigate(`/eleve/devoirs/${d.id}`)} />
          ))}
        </div>
      ) : devoirs && devoirs.length > 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-3" />
            <p className="text-muted-foreground font-medium">Tous tes devoirs sont à jour !</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              De nouveaux devoirs apparaîtront après tes séances.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Pas encore de devoirs</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Tes devoirs apparaîtront ici après ta première séance. Les devoirs sont générés automatiquement après chaque séance.
            </p>
          </CardContent>
        </Card>
      )}

      {completed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Terminés</h2>
          {completed.slice(0, 5).map((d) => (
            <DevoirCard key={d.id} devoir={d} onOpen={() => navigate(`/eleve/devoirs/${d.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
};

function DeadlineDisplay({ dateEcheance, isDone, isExpired }: { dateEcheance: string; isDone: boolean; isExpired: boolean }) {
  if (isDone) return null;

  const deadline = new Date(dateEcheance);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / 86400000);
  const dateStr = format(deadline, "EEEE d MMMM yyyy", { locale: fr });

  if (isExpired || daysLeft < 0) {
    return (
      <div className="flex items-center gap-1.5 text-destructive text-sm mt-1">
        <XCircle className="h-3.5 w-3.5" />
        <span>Devoir en retard — attendu le {dateStr}</span>
      </div>
    );
  }

  if (daysLeft <= 2) {
    return (
      <div className="flex items-center gap-1.5 text-orange-600 text-sm mt-1">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>{daysLeft === 0 ? "À rendre aujourd'hui !" : daysLeft === 1 ? "À rendre demain" : "À rendre dans 2 jours"}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
      <Calendar className="h-3.5 w-3.5" />
      <span>À rendre avant le : {dateStr}</span>
    </div>
  );
}

function DevoirCard({ devoir, onOpen }: { devoir: any; onOpen: () => void }) {
  const ex = devoir.exercice as any;
  const isUrgent = devoir.raison === "remediation";
  const isDone = devoir.statut === "fait" || devoir.statut === "arrete";
  const isExpired = devoir.statut === "expire";

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-muted/30 transition-colors",
        isDone && "opacity-70",
        isExpired && "border-destructive/30"
      )}
      onClick={onOpen}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center h-10 w-10 rounded-xl shrink-0",
            isDone ? "bg-green-100 dark:bg-green-900/30" : isUrgent ? "bg-destructive/10" : "bg-orange-100 dark:bg-orange-900/30"
          )}>
            {isDone ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : isUrgent ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <BookOpen className="h-5 w-5 text-orange-600" />
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">{ex?.titre || "Exercice"}</span>
              {/* Source label badges */}
              {(devoir as any).source_label === "tronc_commun" && !isDone && (
                <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">Exercice du groupe</Badge>
              )}
              {((devoir as any).source_label === "individualise" || (!((devoir as any).source_label) && isUrgent)) && !isDone && (
                <Badge variant="secondary" className="text-xs border-orange-500/30 text-orange-600">Personnalisé</Badge>
              )}
              {!isUrgent && !isDone && !(devoir as any).source_label && (
                <Badge variant="secondary" className="text-xs border-orange-500/30 text-orange-600">À renforcer</Badge>
              )}
              {isDone && (
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">Terminé</Badge>
              )}
              {isExpired && (
                <Badge variant="destructive" className="text-xs">Expiré</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="text-xs"><CompetenceLabel code={ex?.competence} /></Badge>
            </div>
            <DeadlineDisplay dateEcheance={devoir.date_echeance} isDone={isDone} isExpired={isExpired} />
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

export default EleveDevoirs;
