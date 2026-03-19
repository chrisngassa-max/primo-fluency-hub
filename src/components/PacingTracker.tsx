import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, GitCompareArrows, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface GroupPacing {
  groupId: string;
  groupName: string;
  niveau: string;
  seancesFaites: number;
  seancesTotal: number;
  progressPct: number; // actual mastery %
  expectedPct: number; // where they should be based on elapsed sessions
  status: "en_avance" | "dans_les_temps" | "en_retard";
  aiPrediction: string;
}

const STATUS_CONFIG = {
  en_avance: { label: "En avance", color: "bg-green-500", badgeVariant: "default" as const, badgeClass: "bg-green-600 text-white hover:bg-green-700" },
  dans_les_temps: { label: "Dans les temps", color: "bg-green-500", badgeVariant: "default" as const, badgeClass: "bg-green-600 text-white hover:bg-green-700" },
  en_retard: { label: "En retard", color: "bg-destructive", badgeVariant: "destructive" as const, badgeClass: "" },
};

export default function PacingTracker() {
  const { user } = useAuth();
  const [compareOpen, setCompareOpen] = useState(false);

  const { data: groupPacings = [], isLoading } = useQuery({
    queryKey: ["pacing-tracker", user?.id],
    queryFn: async () => {
      // 1. Get all active groups
      const { data: groups } = await supabase
        .from("groups")
        .select("id, nom, niveau")
        .eq("formateur_id", user!.id)
        .eq("is_active", true)
        .order("nom");
      if (!groups?.length) return [];

      const groupIds = groups.map((g) => g.id);

      // 2. Get sessions per group (all statuses) to compute total + completed
      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, group_id, statut")
        .in("group_id", groupIds);

      // 3. Get group members to compute average mastery
      const { data: members } = await supabase
        .from("group_members")
        .select("eleve_id, group_id")
        .in("group_id", groupIds);

      // 4. Get profils_eleves for mastery scores
      const eleveIds = [...new Set((members ?? []).map((m) => m.eleve_id))];
      let profilsMap: Record<string, number> = {};
      if (eleveIds.length > 0) {
        const { data: profils } = await supabase
          .from("profils_eleves")
          .select("eleve_id, taux_reussite_global")
          .in("eleve_id", eleveIds);
        (profils ?? []).forEach((p) => {
          profilsMap[p.eleve_id] = Number(p.taux_reussite_global) || 0;
        });
      }

      // 5. Also check parcours for planned session count
      const { data: parcours } = await supabase
        .from("parcours")
        .select("group_id, nb_seances_prevues")
        .in("group_id", groupIds);

      const parcoursMap: Record<string, number> = {};
      (parcours ?? []).forEach((p) => {
        if (p.group_id) {
          parcoursMap[p.group_id] = Math.max(parcoursMap[p.group_id] || 0, p.nb_seances_prevues || 0);
        }
      });

      // Build pacing data per group
      return groups.map((g): GroupPacing => {
        const groupSessions = (sessions ?? []).filter((s) => s.group_id === g.id);
        const seancesTerminees = groupSessions.filter((s) => s.statut === "terminee").length;
        const seancesTotal = parcoursMap[g.id] || groupSessions.length || 1;

        // Group members average mastery
        const groupMembers = (members ?? []).filter((m) => m.group_id === g.id);
        let avgMastery = 0;
        if (groupMembers.length > 0) {
          const scores = groupMembers.map((m) => profilsMap[m.eleve_id] || 0);
          avgMastery = scores.reduce((a, b) => a + b, 0) / scores.length;
        }

        // Expected: linear interpolation based on sessions done vs total
        const expectedPct = seancesTotal > 0 ? Math.round((seancesTerminees / seancesTotal) * 100) : 0;
        const progressPct = Math.round(avgMastery);

        // Status
        const diff = progressPct - expectedPct;
        let status: GroupPacing["status"];
        if (diff >= 0) {
          status = diff > 5 ? "en_avance" : "dans_les_temps";
        } else {
          status = "en_retard";
        }

        // Simple AI prediction
        let aiPrediction: string;
        if (seancesTerminees === 0) {
          aiPrediction = "Pas encore de séance terminée — impossible de projeter.";
        } else if (status === "en_retard") {
          const deficit = expectedPct - progressPct;
          aiPrediction = `Retard de ${deficit}pts. Au rythme actuel, le groupe n'atteindra pas l'objectif ${g.niveau || "A1"} dans les temps.`;
        } else if (status === "en_avance") {
          aiPrediction = `Le groupe progresse plus vite que prévu. Objectif ${g.niveau || "A1"} atteignable en avance.`;
        } else {
          aiPrediction = `Progression conforme au plan. Objectif ${g.niveau || "A1"} atteignable dans les délais.`;
        }

        return {
          groupId: g.id,
          groupName: g.nom,
          niveau: g.niveau,
          seancesFaites: seancesTerminees,
          seancesTotal,
          progressPct,
          expectedPct,
          status,
          aiPrediction,
        };
      });
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (groupPacings.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Comparateur de Rythme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun groupe actif. Créez un groupe pour suivre le rythme de progression.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Comparateur de Rythme
              </CardTitle>
              <CardDescription className="mt-1">
                Vérifiez si vos groupes sont dans les temps par rapport à l'objectif TCF
              </CardDescription>
            </div>
            {groupPacings.length > 1 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCompareOpen(true)}>
                <GitCompareArrows className="h-4 w-4" />
                Comparer les Groupes
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {groupPacings.map((gp) => (
            <BulletChart key={gp.groupId} data={gp} />
          ))}
        </CardContent>
      </Card>

      {/* Comparison Modal */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comparaison des Groupes</DialogTitle>
            <DialogDescription>
              Vue croisée du rythme de progression de tous vos groupes actifs
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Groupe</TableHead>
                  <TableHead className="text-center">Programme</TableHead>
                  <TableHead className="text-center">Maîtrise</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                  <TableHead>Prédiction IA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupPacings.map((gp) => {
                  const cfg = STATUS_CONFIG[gp.status];
                  return (
                    <TableRow key={gp.groupId}>
                      <TableCell className="font-medium">
                        {gp.groupName}
                        <span className="text-xs text-muted-foreground ml-1.5">({gp.niveau})</span>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {gp.seancesFaites} / {gp.seancesTotal} séances
                      </TableCell>
                      <TableCell className="text-center font-semibold text-sm">
                        {gp.progressPct}%
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cfg.badgeClass} variant={cfg.badgeVariant}>
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                        {gp.aiPrediction}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function BulletChart({ data }: { data: GroupPacing }) {
  const barColor = data.status === "en_retard"
    ? "bg-destructive"
    : "bg-green-500";

  const statusIcon = data.status === "en_retard"
    ? <TrendingDown className="h-3.5 w-3.5 text-destructive" />
    : data.status === "en_avance"
    ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
    : <Minus className="h-3.5 w-3.5 text-green-600" />;

  const cfg = STATUS_CONFIG[data.status];

  return (
    <div className="space-y-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground">{data.groupName}</span>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5">{data.niveau}</Badge>
          <span className="text-xs text-muted-foreground">
            {data.seancesFaites}/{data.seancesTotal} séances
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {statusIcon}
          <Badge className={`text-[10px] h-5 ${cfg.badgeClass}`} variant={cfg.badgeVariant}>
            {cfg.label}
          </Badge>
        </div>
      </div>

      {/* Bullet bar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative h-7 w-full rounded-md bg-muted/60 border overflow-visible">
            {/* Background track with subtle gradient zones */}
            <div className="absolute inset-0 rounded-md overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-muted/40" style={{ width: "60%" }} />
              <div className="absolute inset-y-0 bg-muted/20" style={{ left: "60%", width: "20%" }} />
              <div className="absolute inset-y-0 bg-muted/10" style={{ left: "80%", width: "20%" }} />
            </div>

            {/* Actual progress bar */}
            <div
              className={`absolute inset-y-0 left-0 rounded-l-md ${barColor} transition-all duration-700 ease-out`}
              style={{ width: `${Math.min(data.progressPct, 100)}%`, opacity: 0.85 }}
            />

            {/* Progress label inside bar */}
            <div className="absolute inset-y-0 left-0 flex items-center pl-2 z-10"
              style={{ width: `${Math.min(data.progressPct, 100)}%` }}>
              {data.progressPct >= 10 && (
                <span className="text-[11px] font-bold text-white drop-shadow-sm">
                  {data.progressPct}%
                </span>
              )}
            </div>

            {/* Expected marker (vertical line) */}
            {data.expectedPct > 0 && data.expectedPct <= 100 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 z-20"
                style={{ left: `${data.expectedPct}%` }}
              >
                <div className="absolute inset-y-0 w-0.5 bg-foreground/80" />
                {/* Triangle marker on top */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-foreground/80" />
                {/* Label */}
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-[9px] text-muted-foreground font-medium">
                    Attendu {data.expectedPct}%
                  </span>
                </div>
              </div>
            )}

            {/* 100% goal marker */}
            <div className="absolute right-1 inset-y-0 flex items-center z-10">
              {data.progressPct < 90 && (
                <span className="text-[9px] text-muted-foreground font-medium">100%</span>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">
            <strong>Maîtrise actuelle :</strong> {data.progressPct}% · 
            <strong> Attendu :</strong> {data.expectedPct}% · 
            <strong> Séances :</strong> {data.seancesFaites}/{data.seancesTotal}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{data.aiPrediction}</p>
        </TooltipContent>
      </Tooltip>

      {/* Bottom spacing for the "Attendu" label */}
      <div className="h-2" />
    </div>
  );
}
