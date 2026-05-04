import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Users } from "lucide-react";
import { detectAdvancedStudentsBatch, type AdvancedSignal } from "@/lib/detectAdvancedStudent";
import { AdvancedStudentBadge } from "@/components/AdvancedStudentBadge";

type ObjectifStatus = "absent" | "non_atteint" | "a_consolider" | "atteint" | "au_dela";
type Besoin = "rattrapage" | "remediation" | "consolidation" | "approfondissement" | "aucun";
type VitesseLecture = "lente" | "fluide";

interface RowState {
  eleve_id: string;
  prenom: string;
  nom: string;
  present: boolean;
  outcome_id?: string;
  objectif_status: ObjectifStatus | "";
  points_vigilance: string;
  points_forts: string;
  besoin_pedagogique: Besoin | "";
  vitesse_lecture: VitesseLecture | "";
  devoir_recommande: string;
  decision_formateur: string;
  dirty: boolean;
}

interface Props {
  sessionId: string;
  groupId?: string | null;
}

const OBJECTIF_OPTIONS: { value: ObjectifStatus; label: string }[] = [
  { value: "absent", label: "Absent" },
  { value: "non_atteint", label: "Non atteint" },
  { value: "a_consolider", label: "À consolider" },
  { value: "atteint", label: "Atteint" },
  { value: "au_dela", label: "Au-delà" },
];

const BESOIN_OPTIONS: { value: Besoin; label: string }[] = [
  { value: "rattrapage", label: "Rattrapage" },
  { value: "remediation", label: "Remédiation" },
  { value: "consolidation", label: "Consolidation" },
  { value: "approfondissement", label: "Approfondissement" },
  { value: "aucun", label: "Aucun" },
];

const VITESSE_LECTURE_OPTIONS: { value: VitesseLecture; label: string }[] = [
  { value: "lente", label: "Lecture lente" },
  { value: "fluide", label: "Lecture fluide" },
];

export function SessionStudentOutcomesTable({ sessionId, groupId }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<RowState[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["session-student-outcomes", sessionId, groupId],
    enabled: !!sessionId && !!groupId,
    queryFn: async () => {
      const [membersRes, presencesRes, outcomesRes] = await Promise.all([
        supabase
          .from("group_members")
          .select("eleve_id, profile:profiles(id, prenom, nom)")
          .eq("group_id", groupId!),
        supabase.from("presences").select("eleve_id, present").eq("session_id", sessionId),
        supabase.from("session_student_outcomes").select("*").eq("session_id", sessionId),
      ]);
      if (membersRes.error) throw membersRes.error;
      if (presencesRes.error) throw presencesRes.error;
      if (outcomesRes.error) throw outcomesRes.error;
      const memberIds = (membersRes.data ?? []).map((m: any) => m.eleve_id);
      const profilsRes = memberIds.length
        ? await supabase.from("profils_eleves").select("eleve_id, vitesse_lecture").in("eleve_id", memberIds)
        : { data: [], error: null };
      if (profilsRes.error) throw profilsRes.error;
      return {
        members: membersRes.data ?? [],
        presences: presencesRes.data ?? [],
        outcomes: outcomesRes.data ?? [],
        profils: profilsRes.data ?? [],
      };
    },
  });

  const eleveIds = useMemo(
    () => (data?.members ?? []).map((m: any) => m.eleve_id),
    [data]
  );
  const { data: advancedMap = {} as Record<string, AdvancedSignal> } = useQuery({
    queryKey: ["session-outcomes-advanced", sessionId, user?.id, eleveIds.join(",")],
    queryFn: () => detectAdvancedStudentsBatch(eleveIds, user!.id),
    enabled: !!user?.id && eleveIds.length > 0,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data) return;
    const presenceMap = new Map<string, boolean>(
      (data.presences as any[]).map((p) => [p.eleve_id, !!p.present])
    );
    const outcomeMap = new Map<string, any>(
      (data.outcomes as any[]).map((o) => [o.eleve_id, o])
    );
    const profilMap = new Map<string, any>(
      (data.profils as any[]).map((p) => [p.eleve_id, p])
    );
    const next: RowState[] = (data.members as any[]).map((m) => {
      const present = presenceMap.get(m.eleve_id) ?? true;
      const existing = outcomeMap.get(m.eleve_id);
      const defaultStatus: ObjectifStatus | "" = existing?.objectif_status
        ? existing.objectif_status
        : present ? "" : "absent";
      return {
        eleve_id: m.eleve_id,
        prenom: m.profile?.prenom ?? "",
        nom: m.profile?.nom ?? "",
        present,
        outcome_id: existing?.id,
        objectif_status: defaultStatus,
        points_vigilance: existing?.points_vigilance ?? "",
        points_forts: existing?.points_forts ?? "",
        besoin_pedagogique: existing?.besoin_pedagogique ?? "",
        vitesse_lecture: profilMap.get(m.eleve_id)?.vitesse_lecture ?? "",
        devoir_recommande: existing?.devoir_recommande ?? "",
        decision_formateur: existing?.decision_formateur ?? "",
        dirty: false,
      };
    });
    next.sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`));
    setRows(next);
  }, [data]);

  const updateRow = (eleveId: string, patch: Partial<RowState>) => {
    setRows((prev) =>
      prev.map((r) => (r.eleve_id === eleveId ? { ...r, ...patch, dirty: true } : r))
    );
  };

  const dirtyCount = useMemo(() => rows.filter((r) => r.dirty).length, [rows]);

  const handleSaveAll = async () => {
    if (!user) return;
    const dirtyRows = rows.filter((r) => r.dirty);
    if (dirtyRows.length === 0) {
      toast.info("Aucune modification à enregistrer.");
      return;
    }
    setSaving(true);
    try {
      const payload = dirtyRows.map((r) => ({
        session_id: sessionId,
        eleve_id: r.eleve_id,
        formateur_id: user.id,
        objectif_status: r.objectif_status || null,
        points_vigilance: r.points_vigilance || null,
        points_forts: r.points_forts || null,
        besoin_pedagogique: r.besoin_pedagogique || null,
        devoir_recommande: r.devoir_recommande || null,
        decision_formateur: r.decision_formateur || null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("session_student_outcomes")
        .upsert(payload as any, { onConflict: "session_id,eleve_id" });
      if (error) throw error;
      const profilePayload = dirtyRows
        .filter((r) => r.vitesse_lecture)
        .map((r) => ({
          eleve_id: r.eleve_id,
          vitesse_lecture: r.vitesse_lecture || null,
          updated_at: new Date().toISOString(),
        }));
      if (profilePayload.length > 0) {
        for (const profileUpdate of profilePayload) {
          const { error: profileError } = await supabase
            .from("profils_eleves")
            .update({
              vitesse_lecture: profileUpdate.vitesse_lecture,
              updated_at: profileUpdate.updated_at,
            } as any)
            .eq("eleve_id", profileUpdate.eleve_id);
          if (profileError) throw profileError;
        }
      }
      toast.success(`${dirtyRows.length} observation(s) enregistrée(s)`);
      await refetch();
    } catch (e: any) {
      toast.error("Erreur d'enregistrement", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="print:hidden">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          Chargement des élèves…
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="print:hidden">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Aucun élève dans ce groupe.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Observation par élève
            </CardTitle>
            <CardDescription>
              Bilan formateur individuel — non visible par les élèves.
            </CardDescription>
          </div>
          <Button onClick={handleSaveAll} disabled={saving || dirtyCount === 0} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Enregistrer{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Élève</TableHead>
                <TableHead>Présence</TableHead>
                <TableHead className="min-w-[160px]">Objectif</TableHead>
                <TableHead className="min-w-[200px]">Points de vigilance</TableHead>
                <TableHead className="min-w-[170px]">Besoin</TableHead>
                <TableHead className="min-w-[170px]">Lecture</TableHead>
                <TableHead className="min-w-[200px]">Devoir recommandé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.eleve_id}>
                  <TableCell className="font-medium align-top">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{r.prenom} {r.nom}</span>
                      <AdvancedStudentBadge signal={advancedMap[r.eleve_id]} compact />
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    {r.present ? (
                      <Badge variant="secondary">Présent</Badge>
                    ) : (
                      <Badge variant="destructive">Absent</Badge>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <Select
                      value={r.objectif_status || undefined}
                      onValueChange={(v) => updateRow(r.eleve_id, { objectif_status: v as ObjectifStatus })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {OBJECTIF_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="align-top">
                    <Textarea
                      value={r.points_vigilance}
                      onChange={(e) => updateRow(r.eleve_id, { points_vigilance: e.target.value })}
                      placeholder="…"
                      className="min-h-[60px] text-sm"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Select
                      value={r.besoin_pedagogique || undefined}
                      onValueChange={(v) => updateRow(r.eleve_id, { besoin_pedagogique: v as Besoin })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {BESOIN_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="align-top">
                    <Select
                      value={r.vitesse_lecture || undefined}
                      onValueChange={(v) => updateRow(r.eleve_id, { vitesse_lecture: v as VitesseLecture })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="â€”" />
                      </SelectTrigger>
                      <SelectContent>
                        {VITESSE_LECTURE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="align-top">
                    <Textarea
                      value={r.devoir_recommande}
                      onChange={(e) => updateRow(r.eleve_id, { devoir_recommande: e.target.value })}
                      placeholder="…"
                      className="min-h-[60px] text-sm"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
