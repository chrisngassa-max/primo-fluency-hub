import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, GitCompareArrows, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Users, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Average duration per exercise type in minutes (TCF IRN standards)
const EXERCISE_DURATION_MINUTES: Record<string, number> = {
  CO: 0.75, // 45 seconds
  CE: 3,
  EE: 3,
  EO: 3,
  Structures: 1.5,
};
const DEFAULT_EXERCISE_DURATION = 2; // fallback

interface GroupMember {
  eleve_id: string;
  nom: string;
  progression: number;
  homeworkHours: number;
  pacingStatus: PacingStatus;
}

export type PacingStatus = "en_avance" | "dans_les_temps" | "en_retard" | "retard_important" | "pas_commence";

interface GroupPacing {
  groupId: string;
  groupName: string;
  niveau: string;
  seancesFaites: number;
  seancesTotal: number;
  progressPct: number;
  expectedPct: number;
  homeworkHoursTotal: number;
  status: PacingStatus;
  aiPrediction: string;
}

export const STATUS_CONFIG: Record<PacingStatus, { label: string; color: string; badgeVariant: "default" | "secondary" | "destructive"; badgeClass: string }> = {
  en_avance: { label: "En avance", color: "bg-green-500", badgeVariant: "default", badgeClass: "bg-green-600 text-white hover:bg-green-700" },
  dans_les_temps: { label: "Dans les temps", color: "bg-green-500", badgeVariant: "default", badgeClass: "bg-green-600 text-white hover:bg-green-700" },
  en_retard: { label: "En retard", color: "bg-destructive", badgeVariant: "secondary", badgeClass: "bg-orange-500 text-white hover:bg-orange-600" },
  retard_important: { label: "Retard important", color: "bg-destructive", badgeVariant: "destructive", badgeClass: "" },
  pas_commence: { label: "Non démarré", color: "bg-muted", badgeVariant: "secondary", badgeClass: "" },
};

const TOTAL_PROGRAM_HOURS = 60;

/** Compute homework hours from an array of completed devoirs with exercice competence */
function computeHomeworkHours(devoirs: { competence?: string }[]) {
  let totalMinutes = 0;
  for (const d of devoirs) {
    totalMinutes += EXERCISE_DURATION_MINUTES[d.competence || ""] || DEFAULT_EXERCISE_DURATION;
  }
  return totalMinutes / 60;
}

/** Compute pacing status given session hours + homework hours vs expected */
export function computePacingStatus(
  sessionHours: number,
  homeworkHours: number,
  expectedHours: number,
): PacingStatus {
  const totalHours = sessionHours + homeworkHours;
  if (totalHours === 0) return "pas_commence";
  const ratio = totalHours / Math.max(expectedHours, 1);
  if (ratio >= 1.1) return "en_avance";
  if (ratio >= 0.8) return "dans_les_temps";
  if (ratio >= 0.5) return "en_retard";
  return "retard_important";
}

/** Student-facing pacing card */
export function StudentPacingCard({ eleveId }: { eleveId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-pacing", eleveId],
    queryFn: async () => {
      // Get student's group memberships
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("eleve_id", eleveId);
      if (!memberships?.length) return null;
      const groupIds = memberships.map((m) => m.group_id);

      // Get sessions for those groups
      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, group_id, statut, duree_minutes")
        .in("group_id", groupIds);

      const completedSessions = (sessions ?? []).filter((s) => s.statut === "terminee");
      const sessionHours = completedSessions.reduce((sum, s) => sum + (s.duree_minutes || 90) / 60, 0);

      // Get completed homework
      const { data: devoirs } = await supabase
        .from("devoirs")
        .select("id, exercice:exercices(competence)")
        .eq("eleve_id", eleveId)
        .eq("statut", "fait");

      const hwHours = computeHomeworkHours(
        (devoirs ?? []).map((d: any) => ({ competence: d.exercice?.competence }))
      );

      // Get total planned sessions
      const { data: parcours } = await supabase
        .from("parcours")
        .select("nb_seances_prevues")
        .in("group_id", groupIds);
      const totalPlannedSessions = Math.max(
        ...(parcours ?? []).map((p) => p.nb_seances_prevues || 0),
        (sessions ?? []).length || 1
      );
      const totalSessions = (sessions ?? []).length;
      const expectedSessionHours = totalPlannedSessions > 0
        ? (completedSessions.length / totalPlannedSessions) * TOTAL_PROGRAM_HOURS
        : 0;

      const totalHours = sessionHours + hwHours;
      const progressPct = Math.min(100, Math.round((totalHours / TOTAL_PROGRAM_HOURS) * 100));
      const expectedPct = Math.min(100, Math.round((expectedSessionHours / TOTAL_PROGRAM_HOURS) * 100));
      const status = computePacingStatus(sessionHours, hwHours, expectedSessionHours);

      // Get mastery
      const { data: profil } = await supabase
        .from("profils_eleves")
        .select("taux_reussite_global")
        .eq("eleve_id", eleveId)
        .maybeSingle();

      return {
        sessionHours: Math.round(sessionHours * 10) / 10,
        hwHours: Math.round(hwHours * 10) / 10,
        totalHours: Math.round(totalHours * 10) / 10,
        progressPct,
        expectedPct,
        status,
        mastery: Math.round(Number(profil?.taux_reussite_global ?? 0)),
        completedSessions: completedSessions.length,
        totalSessions: totalPlannedSessions,
      };
    },
    enabled: !!eleveId,
  });

  if (isLoading) return <Skeleton className="h-36 w-full" />;
  if (!data) return null;

  const cfg = STATUS_CONFIG[data.status];

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Mon rythme — Objectif {TOTAL_PROGRAM_HOURS}h
        </CardTitle>
        <CardDescription>
          Progression vers l'objectif de formation TCF IRN
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status badge */}
        <div className="flex items-center justify-between">
          <Badge className={cfg.badgeClass} variant={cfg.badgeVariant}>
            {cfg.label}
          </Badge>
          <span className="text-sm font-bold">{data.totalHours}h / {TOTAL_PROGRAM_HOURS}h</span>
        </div>

        {/* Progress bar with expected marker */}
        <div className="relative">
          <Progress
            value={data.progressPct}
            className={cn("h-5", data.status === "en_retard" || data.status === "retard_important" ? "[&>div]:bg-orange-500" : "[&>div]:bg-green-500")}
          />
          {data.expectedPct > 0 && data.expectedPct <= 100 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/70 z-10"
              style={{ left: `${data.expectedPct}%` }}
            >
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-[9px] text-muted-foreground font-medium">Attendu {data.expectedPct}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-3 gap-3 text-center pt-2">
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{data.sessionHours}h</p>
            <p className="text-[11px] text-muted-foreground">En séance</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{data.hwHours}h</p>
            <p className="text-[11px] text-muted-foreground">Devoirs</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{data.mastery}%</p>
            <p className="text-[11px] text-muted-foreground">Maîtrise</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PacingTracker() {
  const { user } = useAuth();
  const [compareOpen, setCompareOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Fetch group members for expanded view (with homework data)
  const { data: groupMembersMap = {} } = useQuery({
    queryKey: ["pacing-group-members", user?.id],
    queryFn: async () => {
      const { data: groups } = await supabase.from("groups").select("id").eq("formateur_id", user!.id);
      if (!groups?.length) return {};
      const groupIds = groups.map((g) => g.id);
      const { data: members } = await supabase.from("group_members").select("eleve_id, group_id").in("group_id", groupIds);
      if (!members?.length) return {};
      const eleveIds = [...new Set(members.map((m) => m.eleve_id))];

      const [{ data: profiles }, { data: profils }, { data: devoirs }, { data: sessions }] = await Promise.all([
        supabase.from("profiles").select("id, nom, prenom").in("id", eleveIds),
        supabase.from("profils_eleves").select("eleve_id, taux_reussite_global").in("eleve_id", eleveIds),
        supabase.from("devoirs").select("eleve_id, exercice:exercices(competence)").eq("statut", "fait").in("eleve_id", eleveIds),
        supabase.from("sessions").select("id, group_id, statut, duree_minutes").in("group_id", groupIds).eq("statut", "terminee"),
      ]);

      const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, `${p.prenom} ${p.nom}`]));
      const scoreMap = Object.fromEntries((profils ?? []).map((p) => [p.eleve_id, Number(p.taux_reussite_global) || 0]));

      // Compute per-student homework hours
      const hwMap: Record<string, number> = {};
      for (const d of (devoirs ?? []) as any[]) {
        if (!hwMap[d.eleve_id]) hwMap[d.eleve_id] = 0;
        hwMap[d.eleve_id] += (EXERCISE_DURATION_MINUTES[d.exercice?.competence || ""] || DEFAULT_EXERCISE_DURATION) / 60;
      }

      // Session hours per group
      const sessionHoursPerGroup: Record<string, number> = {};
      for (const s of (sessions ?? [])) {
        if (!sessionHoursPerGroup[s.group_id]) sessionHoursPerGroup[s.group_id] = 0;
        sessionHoursPerGroup[s.group_id] += (s.duree_minutes || 90) / 60;
      }

      const result: Record<string, GroupMember[]> = {};
      for (const gId of groupIds) {
        const groupSessionHours = sessionHoursPerGroup[gId] || 0;
        const expectedHours = (groupSessionHours / TOTAL_PROGRAM_HOURS) * TOTAL_PROGRAM_HOURS; // proportional
        result[gId] = members.filter((m) => m.group_id === gId).map((m) => ({
          eleve_id: m.eleve_id,
          nom: nameMap[m.eleve_id] || "Élève",
          progression: scoreMap[m.eleve_id] ?? 0,
          homeworkHours: Math.round((hwMap[m.eleve_id] || 0) * 10) / 10,
          pacingStatus: computePacingStatus(groupSessionHours, hwMap[m.eleve_id] || 0, TOTAL_PROGRAM_HOURS * 0.5),
        }));
      }
      return result;
    },
    enabled: !!user,
  });

  const { data: groupPacings = [], isLoading } = useQuery({
    queryKey: ["pacing-tracker", user?.id],
    queryFn: async () => {
      const { data: groups } = await supabase
        .from("groups")
        .select("id, nom, niveau")
        .eq("formateur_id", user!.id)
        .eq("is_active", true)
        .order("nom");
      if (!groups?.length) return [];

      const groupIds = groups.map((g) => g.id);

      const [{ data: sessions }, { data: members }, { data: parcours }] = await Promise.all([
        supabase.from("sessions").select("id, group_id, statut, duree_minutes").in("group_id", groupIds),
        supabase.from("group_members").select("eleve_id, group_id").in("group_id", groupIds),
        supabase.from("parcours").select("group_id, nb_seances_prevues").in("group_id", groupIds),
      ]);

      const eleveIds = [...new Set((members ?? []).map((m) => m.eleve_id))];

      const [{ data: profils }, { data: devoirs }] = await Promise.all([
        eleveIds.length > 0
          ? supabase.from("profils_eleves").select("eleve_id, taux_reussite_global").in("eleve_id", eleveIds)
          : { data: [] },
        eleveIds.length > 0
          ? supabase.from("devoirs").select("eleve_id, exercice:exercices(competence)").eq("statut", "fait").in("eleve_id", eleveIds)
          : { data: [] },
      ]);

      const profilsMap: Record<string, number> = {};
      (profils ?? []).forEach((p) => { profilsMap[p.eleve_id] = Number(p.taux_reussite_global) || 0; });

      // Compute per-student homework hours
      const hwPerStudent: Record<string, number> = {};
      for (const d of (devoirs ?? []) as any[]) {
        if (!hwPerStudent[d.eleve_id]) hwPerStudent[d.eleve_id] = 0;
        hwPerStudent[d.eleve_id] += (EXERCISE_DURATION_MINUTES[d.exercice?.competence || ""] || DEFAULT_EXERCISE_DURATION) / 60;
      }

      const parcoursMap: Record<string, number> = {};
      (parcours ?? []).forEach((p) => {
        if (p.group_id) parcoursMap[p.group_id] = Math.max(parcoursMap[p.group_id] || 0, p.nb_seances_prevues || 0);
      });

      return groups.map((g): GroupPacing => {
        const groupSessions = (sessions ?? []).filter((s) => s.group_id === g.id);
        const completedSessions = groupSessions.filter((s) => s.statut === "terminee");
        const seancesTerminees = completedSessions.length;
        const seancesTotal = parcoursMap[g.id] || groupSessions.length || 1;

        // Session hours
        const sessionHours = completedSessions.reduce((sum, s) => sum + (s.duree_minutes || 90) / 60, 0);

        // Group members and their homework hours
        const groupMembers = (members ?? []).filter((m) => m.group_id === g.id);
        let avgMastery = 0;
        let totalHomeworkHours = 0;
        if (groupMembers.length > 0) {
          const scores = groupMembers.map((m) => profilsMap[m.eleve_id] || 0);
          avgMastery = scores.reduce((a, b) => a + b, 0) / scores.length;
          totalHomeworkHours = groupMembers.reduce((sum, m) => sum + (hwPerStudent[m.eleve_id] || 0), 0) / groupMembers.length;
        }

        // Total effective hours = session hours + average homework hours per student
        const totalEffectiveHours = sessionHours + totalHomeworkHours;
        const progressPct = Math.min(100, Math.round((totalEffectiveHours / TOTAL_PROGRAM_HOURS) * 100));
        const expectedPct = seancesTotal > 0 ? Math.round((seancesTerminees / seancesTotal) * 100) : 0;

        const status = computePacingStatus(sessionHours, totalHomeworkHours, (seancesTerminees / Math.max(seancesTotal, 1)) * TOTAL_PROGRAM_HOURS);

        let aiPrediction: string;
        if (status === "pas_commence") {
          aiPrediction = "Pas encore de séance terminée — impossible de projeter.";
        } else if (status === "retard_important") {
          aiPrediction = `Retard important. ${Math.round(totalEffectiveHours)}h effectives sur ${TOTAL_PROGRAM_HOURS}h. Risque de ne pas atteindre l'objectif ${g.niveau || "A1"}.`;
        } else if (status === "en_retard") {
          aiPrediction = `En retard sur le programme. ${Math.round(totalHomeworkHours * 10) / 10}h de devoirs complétés en moyenne. Objectif ${g.niveau || "A1"} sera difficile.`;
        } else if (status === "en_avance") {
          aiPrediction = `Le groupe progresse plus vite que prévu (+${Math.round(totalHomeworkHours * 10) / 10}h devoirs). Objectif ${g.niveau || "A1"} atteignable en avance.`;
        } else {
          aiPrediction = `Progression conforme. ${Math.round(totalEffectiveHours)}h effectives (dont ${Math.round(totalHomeworkHours * 10) / 10}h devoirs). Objectif ${g.niveau || "A1"} dans les délais.`;
        }

        return {
          groupId: g.id,
          groupName: g.nom,
          niveau: g.niveau,
          seancesFaites: seancesTerminees,
          seancesTotal,
          progressPct,
          expectedPct,
          homeworkHoursTotal: Math.round(totalHomeworkHours * 10) / 10,
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
                Comparateur de Rythme — Objectif {TOTAL_PROGRAM_HOURS}h
              </CardTitle>
              <CardDescription className="mt-1">
                Séances + devoirs quotidiens comptabilisés vers l'objectif TCF
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
            <BulletChart key={gp.groupId} data={gp} onGroupClick={setExpandedGroup} expandedGroup={expandedGroup} members={groupMembersMap[gp.groupId]} />
          ))}
        </CardContent>
      </Card>

      {/* Comparison Modal */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comparaison des Groupes</DialogTitle>
            <DialogDescription>
              Vue croisée du rythme de progression (séances + devoirs)
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Groupe</TableHead>
                  <TableHead className="text-center">Programme</TableHead>
                  <TableHead className="text-center">Devoirs (moy.)</TableHead>
                  <TableHead className="text-center">Avancement</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
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
                      <TableCell className="text-center text-sm">
                        {gp.homeworkHoursTotal}h
                      </TableCell>
                      <TableCell className="text-center font-semibold text-sm">
                        {gp.progressPct}%
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cfg.badgeClass} variant={cfg.badgeVariant}>
                          {cfg.label}
                        </Badge>
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

function BulletChart({ data, onGroupClick, expandedGroup, members }: { data: GroupPacing; onGroupClick: (id: string | null) => void; expandedGroup: string | null; members?: GroupMember[] }) {
  const navigate = useNavigate();
  const isExpanded = expandedGroup === data.groupId;
  const barColor = data.status === "en_retard" || data.status === "retard_important"
    ? "bg-destructive"
    : data.status === "pas_commence" ? "bg-muted" : "bg-green-500";

  const statusIcon = data.status === "en_retard" || data.status === "retard_important"
    ? <TrendingDown className="h-3.5 w-3.5 text-destructive" />
    : data.status === "en_avance"
    ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
    : data.status === "pas_commence"
    ? <Minus className="h-3.5 w-3.5 text-muted-foreground" />
    : <Minus className="h-3.5 w-3.5 text-green-600" />;

  const cfg = STATUS_CONFIG[data.status];

  return (
    <div className="space-y-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 font-medium text-sm text-foreground hover:text-primary transition-colors cursor-pointer"
            onClick={() => onGroupClick(isExpanded ? null : data.groupId)}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {data.groupName}
          </button>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5">{data.niveau}</Badge>
          <span className="text-xs text-muted-foreground">
            {data.seancesFaites}/{data.seancesTotal} séances · +{data.homeworkHoursTotal}h devoirs
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
            <div className="absolute inset-0 rounded-md overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-muted/40" style={{ width: "60%" }} />
              <div className="absolute inset-y-0 bg-muted/20" style={{ left: "60%", width: "20%" }} />
              <div className="absolute inset-y-0 bg-muted/10" style={{ left: "80%", width: "20%" }} />
            </div>
            <div
              className={`absolute inset-y-0 left-0 rounded-l-md ${barColor} transition-all duration-700 ease-out`}
              style={{ width: `${Math.min(data.progressPct, 100)}%`, opacity: 0.85 }}
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-2 z-10"
              style={{ width: `${Math.min(data.progressPct, 100)}%` }}>
              {data.progressPct >= 10 && (
                <span className="text-[11px] font-bold text-white drop-shadow-sm">
                  {data.progressPct}%
                </span>
              )}
            </div>
            {data.expectedPct > 0 && data.expectedPct <= 100 && (
              <div className="absolute top-0 bottom-0 w-0.5 z-20" style={{ left: `${data.expectedPct}%` }}>
                <div className="absolute inset-y-0 w-0.5 bg-foreground/80" />
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-foreground/80" />
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-[9px] text-muted-foreground font-medium">Attendu {data.expectedPct}%</span>
                </div>
              </div>
            )}
            <div className="absolute right-1 inset-y-0 flex items-center z-10">
              {data.progressPct < 90 && (
                <span className="text-[9px] text-muted-foreground font-medium">100%</span>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">
            <strong>Avancement :</strong> {data.progressPct}% · 
            <strong> Attendu :</strong> {data.expectedPct}% · 
            <strong> Devoirs moy. :</strong> {data.homeworkHoursTotal}h
          </p>
          <p className="text-xs text-muted-foreground mt-1">{data.aiPrediction}</p>
        </TooltipContent>
      </Tooltip>

      <div className="h-2" />

      {/* Expanded member list */}
      {isExpanded && (
        <div className="pl-4 pb-2 space-y-1 border-l-2 border-primary/20 ml-1">
          {(!members || members.length === 0) ? (
            <p className="text-xs text-muted-foreground py-2 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Aucun élève dans ce groupe
            </p>
          ) : (
            members.map((m) => {
              const memberCfg = STATUS_CONFIG[m.pacingStatus];
              return (
                <div
                  key={m.eleve_id}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/formateur/eleves/${m.eleve_id}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{m.nom}</span>
                    {m.homeworkHours > 0 && (
                      <span className="text-[10px] text-muted-foreground">+{m.homeworkHours}h devoirs</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(m.progression, 100)}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(m.progression)}%</span>
                    <Badge className={`text-[9px] h-4 px-1 ${memberCfg.badgeClass}`} variant={memberCfg.badgeVariant}>
                      {memberCfg.label}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
