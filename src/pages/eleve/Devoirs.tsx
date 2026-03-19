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
  Send, Loader2, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CompetenceLabel from "@/components/CompetenceLabel";

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
          {pending.length} devoir(s) en attente
        </p>
      </div>

      {/* Stats */}
      {devoirs && devoirs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold text-orange-600">{pending.length}</p>
              <p className="text-[11px] text-muted-foreground">En attente</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold text-green-600">{completed.length}</p>
              <p className="text-[11px] text-muted-foreground">Terminés</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold text-destructive">{expired.length}</p>
              <p className="text-[11px] text-muted-foreground">Expirés</p>
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
            <p className="text-muted-foreground font-medium">Tous vos devoirs sont à jour !</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              De nouveaux devoirs apparaîtront après vos séances.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Pas encore de devoirs</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Vos devoirs apparaîtront ici après votre première séance avec votre formateur.
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

function DevoirCard({ devoir, onOpen }: { devoir: any; onOpen: () => void }) {
  const ex = devoir.exercice as any;
  const isUrgent = devoir.raison === "remediation";
  const isDone = devoir.statut === "fait" || devoir.statut === "arrete";
  const isExpired = devoir.statut === "expire";
  const daysLeft = Math.max(0, Math.ceil((new Date(devoir.date_echeance).getTime() - Date.now()) / 86400000));

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
              <span className="font-semibold text-sm truncate">{ex?.titre || "Exercice"}</span>
              {isUrgent && !isDone && (
                <Badge variant="destructive" className="text-[10px]">Remédiation</Badge>
              )}
              {!isUrgent && !isDone && (
                <Badge variant="secondary" className="text-[10px] border-orange-500/30 text-orange-600">Consolidation</Badge>
              )}
              {isDone && (
                <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600">Terminé</Badge>
              )}
              {isExpired && (
                <Badge variant="destructive" className="text-[10px]">Expiré</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">{ex?.competence}</Badge>
              {!isDone && !isExpired && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {daysLeft === 0 ? "Aujourd'hui !" : `${daysLeft}j restant(s)`}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

export default EleveDevoirs;
