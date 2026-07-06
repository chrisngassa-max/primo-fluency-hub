// @ts-nocheck — schema-dependent code; types regenerate after supabase migrations apply
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Loader2, Volume2, RefreshCw, FileDown, Mail, GraduationCap, Sparkles, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useExportPDF } from "@/hooks/useExportPDF";
import GenerateTargetedExerciseWizard from "@/components/formateur/GenerateTargetedExerciseWizard";
import { useQuery } from "@tanstack/react-query";
import {
  fetchGroupStudentsForReports,
  resolveStudentExportLabel,
  type StudentProfile,
} from "@/lib/reportExportPrivacy";

type Row = {
  type_erreur_id: string | null;
  niveau: string | null;
  competence: string | null;
  occurrences: number;
  interventions_dispatched: number;
  derniere: string;
};

type StudentErrorRow = {
  eleve_id: string;
  nom: string;
  total: number;
  repeated: number;
  competences: string[];
  session_id: string | null;
};

type LiveEvent = {
  session_id: string | null;
  type_erreur_id: string | null;
  competence: string | null;
  event_type: string;
  created_at: string;
  eleve_id: string | null;
  payload: { auto_dispatch?: boolean } | null;
};

type RecentErrorEvent = {
  type_erreur_id: string | null;
  competence: string | null;
  created_at: string;
  event_type: string;
};

const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];
const ERROR_EVENT_TYPES = ["reponse_incorrecte", "erreur_repetee", "intervention_recue"] as const;

function displayStudentName(eleveId: string, profiles: StudentProfile[]): string {
  return resolveStudentExportLabel(eleveId, profiles);
}

function aggregateRows(events: LiveEvent[]): Row[] {
  const map = new Map<string, Row>();
  events.forEach((ev) => {
    const key = `${ev.type_erreur_id || "—"}|${ev.competence || "—"}`;
    const r = map.get(key) || {
      type_erreur_id: ev.type_erreur_id,
      niveau: null,
      competence: ev.competence,
      occurrences: 0,
      interventions_dispatched: 0,
      derniere: ev.created_at,
    };
    if (ev.event_type === "reponse_incorrecte") r.occurrences += 1;
    if (ev.event_type === "intervention_recue" && ev.payload?.auto_dispatch) r.interventions_dispatched += 1;
    if (ev.created_at > r.derniere) r.derniere = ev.created_at;
    map.set(key, r);
  });
  return Array.from(map.values()).sort((a, b) => b.occurrences - a.occurrences);
}

function buildStudentRows(events: LiveEvent[], profiles: StudentProfile[]): StudentErrorRow[] {
  const errorEvents = events.filter(
    (event) => event.eleve_id && (event.event_type === "reponse_incorrecte" || event.event_type === "erreur_repetee"),
  );
  const students = new Map<string, StudentErrorRow>();
  for (const event of errorEvents) {
    const eleveId = event.eleve_id!;
    const current = students.get(eleveId) ?? {
      eleve_id: eleveId,
      nom: displayStudentName(eleveId, profiles),
      total: 0,
      repeated: 0,
      competences: [],
      session_id: event.session_id,
    };
    if (event.event_type === "reponse_incorrecte") current.total += 1;
    if (event.event_type === "erreur_repetee") current.repeated += 1;
    if (event.competence && !current.competences.includes(event.competence)) {
      current.competences.push(event.competence);
    }
    if (event.session_id) current.session_id = event.session_id;
    students.set(eleveId, current);
  }
  return [...students.values()].sort((a, b) => b.total - a.total);
}

function GlobalErrorAnalytics({ sessionScoped = false }: { sessionScoped?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [innerTab, setInnerTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [studentLoading, setStudentLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [typesErreur, setTypesErreur] = useState<Record<string, string>>({});
  const [systemInterventions, setSystemInterventions] = useState<any[]>([]);
  const [studentRows, setStudentRows] = useState<StudentErrorRow[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>([]);
  const [studentDetailRows, setStudentDetailRows] = useState<Row[]>([]);
  const [recentStudentErrors, setRecentStudentErrors] = useState<RecentErrorEvent[]>([]);
  const [studentSessionId, setStudentSessionId] = useState<string | null>(null);
  const [wizardTarget, setWizardTarget] = useState<{ eleveId: string; sessionId: string } | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const { exportPDF, isExporting } = useExportPDF(exportRef);

  const { data: groups = [] } = useQuery({
    queryKey: ["error-analysis-groups", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, nom, niveau")
        .eq("formateur_id", user!.id)
        .eq("is_active", true)
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !sessionScoped && !!user?.id,
  });

  const { data: groupStudents = [], isLoading: loadingGroupStudents } = useQuery({
    queryKey: ["error-analysis-eleves", selectedGroupId],
    queryFn: () => fetchGroupStudentsForReports(supabase, selectedGroupId),
    enabled: !sessionScoped && !!selectedGroupId,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["error-analysis-sessions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, group_id, groups!inner(formateur_id)")
        .eq("groups.formateur_id", user.id)
        .order("date_seance", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: sessionScoped && !!user?.id,
  });

  useEffect(() => {
    if (sessionScoped && !selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessionScoped, sessions]);

  useEffect(() => {
    if (!sessionScoped && !selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [selectedGroupId, sessionScoped, groups]);

  const sinceIso = useMemo(
    () => new Date(Date.now() - Number(period) * 24 * 3600 * 1000).toISOString(),
    [period],
  );

  const resolveSessionIds = useCallback(async (): Promise<string[] | null> => {
    if (sessionScoped && selectedSessionId) return [selectedSessionId];
    if (!sessionScoped && selectedGroupId) {
      const { data, error } = await supabase.from("sessions").select("id").eq("group_id", selectedGroupId);
      if (error) throw error;
      return (data ?? []).map((s) => s.id);
    }
    return null;
  }, [sessionScoped, selectedSessionId, selectedGroupId]);

  const loadProfilesForEvents = useCallback(async (events: LiveEvent[]): Promise<StudentProfile[]> => {
    const eleveIds = [...new Set(events.map((e) => e.eleve_id).filter(Boolean))] as string[];
    if (!eleveIds.length) return groupStudents;
    const { data: profiles } = await supabase.from("profiles").select("id, prenom, nom").in("id", eleveIds);
    return (profiles ?? []) as StudentProfile[];
  }, [groupStudents]);

  async function load() {
    if (sessionScoped && !selectedSessionId) return;
    if (!sessionScoped && !selectedGroupId) return;
    setLoading(true);
    try {
      const sessionIds = await resolveSessionIds();

      let eventsQuery = supabase
        .from("session_live_events")
        .select("session_id, type_erreur_id, competence, event_type, created_at, eleve_id, payload")
        .in("event_type", [...ERROR_EVENT_TYPES])
        .gte("created_at", sinceIso)
        .limit(5000);

      if (sessionIds?.length) {
        eventsQuery = eventsQuery.in("session_id", sessionIds);
      } else if (sessionIds && sessionIds.length === 0) {
        setRows([]);
        setStudentRows([]);
        setStudentProfiles([]);
        return;
      }

      const [{ data: events, error }, { data: types }, { data: interv }] = await Promise.all([
        eventsQuery,
        supabase.from("types_erreur").select("id, libelle"),
        supabase
          .from("interventions")
          .select("id, titre, type_erreur_id, niveau_cible, competence, audio_url, contenu_texte")
          .eq("is_systeme", true)
          .order("type_erreur_id"),
      ]);

      if (error) throw error;

      const typeMap: Record<string, string> = {};
      (types || []).forEach((t: { id: string; libelle: string }) => (typeMap[t.id] = t.libelle));
      setTypesErreur(typeMap);
      setSystemInterventions(interv || []);

      const liveEvents = (events ?? []) as LiveEvent[];
      const profiles = !sessionScoped && groupStudents.length
        ? groupStudents
        : await loadProfilesForEvents(liveEvents);
      setStudentProfiles(profiles);
      setRows(aggregateRows(liveEvents));
      setStudentRows(buildStudentRows(liveEvents, profiles));
    } catch (e: unknown) {
      toast.error("Erreur de chargement : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  const loadStudentDetail = useCallback(async (eleveId: string) => {
    if (!eleveId) {
      setStudentDetailRows([]);
      setRecentStudentErrors([]);
      setStudentSessionId(null);
      return;
    }
    setStudentLoading(true);
    try {
      const sessionIds = await resolveSessionIds();

      let eventsQuery = supabase
        .from("session_live_events")
        .select("session_id, type_erreur_id, competence, event_type, created_at, eleve_id, payload")
        .eq("eleve_id", eleveId)
        .in("event_type", [...ERROR_EVENT_TYPES])
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(500);

      if (sessionIds?.length) {
        eventsQuery = eventsQuery.in("session_id", sessionIds);
      } else if (sessionIds && sessionIds.length === 0) {
        setStudentDetailRows([]);
        setRecentStudentErrors([]);
        setStudentSessionId(null);
        return;
      }

      const { data: events, error } = await eventsQuery;
      if (error) throw error;

      const liveEvents = (events ?? []) as LiveEvent[];
      setStudentDetailRows(aggregateRows(liveEvents));
      setRecentStudentErrors(
        liveEvents
          .filter((e) => e.event_type === "reponse_incorrecte" || e.event_type === "erreur_repetee")
          .slice(0, 30)
          .map((e) => ({
            type_erreur_id: e.type_erreur_id,
            competence: e.competence,
            created_at: e.created_at,
            event_type: e.event_type,
          })),
      );
      setStudentSessionId(liveEvents.find((e) => e.session_id)?.session_id ?? (selectedSessionId || null));
    } catch (e: unknown) {
      toast.error("Erreur chargement élève : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setStudentLoading(false);
    }
  }, [resolveSessionIds, sinceIso, selectedSessionId]);

  useEffect(() => {
    void load();
  }, [period, selectedSessionId, selectedGroupId, sessionScoped, sinceIso]);

  useEffect(() => {
    if (selectedStudentId) void loadStudentDetail(selectedStudentId);
    else {
      setStudentDetailRows([]);
      setRecentStudentErrors([]);
      setStudentSessionId(null);
    }
  }, [selectedStudentId, loadStudentDetail]);

  async function generateAllAudio() {
    setBulkLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-interventions-audio", {
        body: { limit: 200 },
      });
      if (error) throw error;
      toast.success(`Audio généré : ${data.success || 0} ✓ / ${data.failed || 0} ✗`);
      await load();
      if (selectedStudentId) await loadStudentDetail(selectedStudentId);
    } catch (e: unknown) {
      toast.error("Échec génération : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBulkLoading(false);
    }
  }

  const studentOptions = useMemo((): StudentProfile[] => {
    if (!sessionScoped && groupStudents.length) return groupStudents;
    return studentRows.map((s) => ({
      id: s.eleve_id,
      prenom: s.nom.split(" ")[0] ?? "",
      nom: s.nom.split(" ").slice(1).join(" ") || s.nom,
    }));
  }, [sessionScoped, groupStudents, studentRows]);

  const drillDownStudent = (eleveId: string) => {
    setSelectedStudentId(eleveId);
    setInnerTab("students");
  };

  const topErrors = useMemo(() => {
    const byType = new Map<string, number>();
    rows.forEach((r) => {
      const k = r.type_erreur_id || "—";
      byType.set(k, (byType.get(k) || 0) + r.occurrences);
    });
    return Array.from(byType.entries())
      .map(([id, n]) => ({ name: typesErreur[id] || id, value: n }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [rows, typesErreur]);

  const byCompetence = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const k = r.competence || "—";
      map.set(k, (map.get(k) || 0) + r.occurrences);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const studentTopErrors = useMemo(() => {
    const byType = new Map<string, number>();
    studentDetailRows.forEach((r) => {
      const k = r.type_erreur_id || "—";
      byType.set(k, (byType.get(k) || 0) + r.occurrences);
    });
    return Array.from(byType.entries())
      .map(([id, n]) => ({ name: typesErreur[id] || id, value: n }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [studentDetailRows, typesErreur]);

  const studentByCompetence = useMemo(() => {
    const map = new Map<string, number>();
    studentDetailRows.forEach((r) => {
      const k = r.competence || "—";
      map.set(k, (map.get(k) || 0) + r.occurrences);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [studentDetailRows]);

  const studentTotalErreurs = studentDetailRows.reduce((s, r) => s + r.occurrences, 0);
  const studentRepeated = recentStudentErrors.filter((e) => e.event_type === "erreur_repetee").length;
  const studentTopType = studentTopErrors[0]?.name ?? "—";

  const totalErreurs = rows.reduce((s, r) => s + r.occurrences, 0);
  const totalDispatched = rows.reduce((s, r) => s + r.interventions_dispatched, 0);
  const audioReady = systemInterventions.filter((i) => i.audio_url).length;

  const selectedStudentLabel = selectedStudentId
    ? displayStudentName(selectedStudentId, studentOptions.length ? studentOptions : studentProfiles)
    : "";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Analytics erreurs & interventions</h1>
          <p className="text-sm text-muted-foreground">
            Top erreurs détectées et dispatch automatique d'interventions audio.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!sessionScoped && (
            <Select
              value={selectedGroupId}
              onValueChange={(v) => {
                setSelectedGroupId(v);
                setSelectedStudentId("");
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choisir un groupe" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group: { id: string; nom: string; niveau: string }) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.nom} ({group.niveau})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {sessionScoped && (
            <Select value={selectedSessionId} onValueChange={(v) => { setSelectedSessionId(v); setSelectedStudentId(""); }}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Choisir une séance" /></SelectTrigger>
              <SelectContent>
                {sessions.map((session: { id: string; titre: string }) => (
                  <SelectItem key={session.id} value={session.id}>{session.titre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={period} onValueChange={(v: "7" | "30" | "90") => setPeriod(v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="90">90 jours</SelectItem>
            </SelectContent>
          </Select>
          {!sessionScoped && (
            <Select
              value={selectedStudentId || "__all__"}
              onValueChange={(v) => {
                if (v === "__all__") {
                  setSelectedStudentId("");
                  return;
                }
                drillDownStudent(v);
              }}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Filtrer un élève" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les élèves</SelectItem>
                {(groupStudents.length ? groupStudents : studentRows.map((s) => ({ id: s.eleve_id }))).map((s: { id: string }) => (
                  <SelectItem key={s.id} value={s.id}>
                    {displayStudentName(s.id, groupStudents.length ? groupStudents : studentProfiles)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={generateAllAudio} disabled={bulkLoading}>
            {bulkLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Volume2 className="h-4 w-4 mr-2" />}
            Générer audio manquant
          </Button>
          <Button variant="outline" onClick={() => exportPDF({ filename: `analytics-erreurs-${new Date().toISOString().slice(0, 10)}.pdf` })} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            Télécharger PDF
          </Button>
          <Button variant="outline" onClick={() => exportPDF({ sendByEmail: true, sessionTitre: "Analytics erreurs", sessionDate: new Date().toISOString().slice(0, 10), formateurEmail: user?.email })} disabled={isExporting}>
            <Mail className="h-4 w-4 mr-2" />
            Envoyer par e-mail
          </Button>
        </div>
      </div>

      <div ref={exportRef} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI label="Erreurs (période)" value={totalErreurs} />
        <KPI label="Interventions auto-envoyées" value={totalDispatched} />
        <KPI label="Interventions système" value={systemInterventions.length} />
        <KPI
          label="Audio prêt"
          value={`${audioReady} / ${systemInterventions.length}`}
          tone={audioReady === systemInterventions.length ? "success" : "warning"}
        />
      </div>

      <Tabs value={innerTab} onValueChange={setInnerTab}>
        <TabsList className="flex h-auto w-full flex-wrap gap-1">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="details">Détails</TabsTrigger>
          <TabsTrigger value="library">Bibliothèque système</TabsTrigger>
          <TabsTrigger value="students" className="font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <User className="h-4 w-4 mr-1.5" />
            Par élève
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Top 10 types d'erreur</CardTitle></CardHeader>
              <CardContent className="h-80">
                {topErrors.length === 0 ? (
                  <Empty />
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={topErrors} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Répartition par compétence</CardTitle></CardHeader>
              <CardContent className="h-80">
                {byCompetence.length === 0 ? (
                  <Empty />
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={byCompetence} dataKey="value" nameKey="name" outerRadius={100} label>
                        {byCompetence.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader><CardTitle className="text-base">Détail par type d'erreur × compétence</CardTitle></CardHeader>
            <CardContent>
              {rows.length === 0 ? <Empty /> : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-b">
                      <tr>
                        <th className="py-2 pr-4">Type d'erreur</th>
                        <th className="py-2 pr-4">Compétence</th>
                        <th className="py-2 pr-4 text-right">Occurrences</th>
                        <th className="py-2 pr-4 text-right">Interventions auto</th>
                        <th className="py-2 pr-4">Dernière</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-b hover:bg-muted/40">
                          <td className="py-2 pr-4">{typesErreur[r.type_erreur_id || ""] || r.type_erreur_id || "—"}</td>
                          <td className="py-2 pr-4">{r.competence ? <Badge variant="outline">{r.competence}</Badge> : "—"}</td>
                          <td className="py-2 pr-4 text-right font-medium">{r.occurrences}</td>
                          <td className="py-2 pr-4 text-right">{r.interventions_dispatched}</td>
                          <td className="py-2 pr-4 text-xs text-muted-foreground">{new Date(r.derniere).toLocaleString("fr-FR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library">
          <Card>
            <CardHeader><CardTitle className="text-base">Interventions système ({systemInterventions.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {systemInterventions.map((i) => (
                  <div key={i.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{i.titre}</div>
                      <div className="flex gap-1">
                        {i.competence && <Badge variant="outline">{i.competence}</Badge>}
                        {i.niveau_cible && <Badge>{i.niveau_cible}</Badge>}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{i.contenu_texte}</p>
                    {i.audio_url ? (
                      <audio controls src={i.audio_url} className="w-full h-8" />
                    ) : (
                      <Badge variant="secondary" className="text-xs">Audio non généré</Badge>
                    )}
                  </div>
                ))}
                {systemInterventions.length === 0 && <Empty />}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Analyse par élève
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                {!sessionScoped && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Groupe</p>
                    <Select
                      value={selectedGroupId}
                      onValueChange={(v) => {
                        setSelectedGroupId(v);
                        setSelectedStudentId("");
                      }}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Choisir un groupe" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group: { id: string; nom: string; niveau: string }) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.nom} ({group.niveau})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1 min-w-[220px]">
                  <p className="text-xs text-muted-foreground">Élève</p>
                  <Select
                    value={selectedStudentId || ""}
                    onValueChange={setSelectedStudentId}
                    disabled={!sessionScoped && (loadingGroupStudents || !selectedGroupId)}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Sélectionner un élève" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sessionScoped ? studentRows : groupStudents).length === 0 ? (
                        <SelectItem value="__none__" disabled>Aucun élève avec erreurs</SelectItem>
                      ) : (
                        (sessionScoped
                          ? studentRows.map((s) => ({ id: s.eleve_id }))
                          : groupStudents
                        ).map((s: { id: string }) => (
                          <SelectItem key={s.id} value={s.id}>
                            {displayStudentName(s.id, sessionScoped ? studentProfiles : groupStudents)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!selectedStudentId ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Choisissez un élève pour voir ses erreurs, compétences concernées et historique récent.
                  </p>
                  {studentRows.length === 0 ? (
                    <Empty />
                  ) : (
                    studentRows.map((student) => (
                      <button
                        key={student.eleve_id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left hover:bg-muted/40 transition-colors"
                        onClick={() => setSelectedStudentId(student.eleve_id)}
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{student.nom}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="outline">{student.total} erreur(s)</Badge>
                            {student.repeated > 0 && <Badge variant="destructive">{student.repeated} répétée(s)</Badge>}
                            {student.competences.map((competence) => (
                              <Badge key={competence} variant="secondary">{competence}</Badge>
                            ))}
                          </div>
                        </div>
                        <Badge variant="secondary">Analyser</Badge>
                      </button>
                    ))
                  )}
                </div>
              ) : studentLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Chargement des données élève…
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedStudentLabel}</h3>
                      <p className="text-sm text-muted-foreground">Période : {period} jours</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/formateur/preparation-examen/eleve/${selectedStudentId}`)}
                      >
                        <GraduationCap className="h-4 w-4 mr-1.5" />
                        Fiche IPE
                      </Button>
                      <Button
                        size="sm"
                        disabled={!studentSessionId}
                        onClick={() =>
                          studentSessionId &&
                          setWizardTarget({ eleveId: selectedStudentId, sessionId: studentSessionId })
                        }
                      >
                        <Sparkles className="h-4 w-4 mr-1.5" />
                        Exercice ciblé
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <KPI label="Erreurs (période)" value={studentTotalErreurs} />
                    <KPI label="Erreurs répétées" value={studentRepeated} tone={studentRepeated > 0 ? "warning" : undefined} />
                    <KPI label="Type le plus fréquent" value={studentTopType} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader><CardTitle className="text-base">Top types d'erreur — {selectedStudentLabel}</CardTitle></CardHeader>
                      <CardContent className="h-72">
                        {studentTopErrors.length === 0 ? (
                          <Empty />
                        ) : (
                          <ResponsiveContainer>
                            <BarChart data={studentTopErrors} layout="vertical" margin={{ left: 100 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" />
                              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Bar dataKey="value" fill="#dc2626" />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader><CardTitle className="text-base">Compétences concernées</CardTitle></CardHeader>
                      <CardContent className="h-72">
                        {studentByCompetence.length === 0 ? (
                          <Empty />
                        ) : (
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie data={studentByCompetence} dataKey="value" nameKey="name" outerRadius={90} label>
                                {studentByCompetence.map((_, i) => (
                                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                                ))}
                              </Pie>
                              <Legend />
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader><CardTitle className="text-base">Erreurs récentes</CardTitle></CardHeader>
                    <CardContent>
                      {recentStudentErrors.length === 0 ? (
                        <Empty />
                      ) : (
                        <div className="overflow-auto">
                          <table className="w-full text-sm">
                            <thead className="text-left text-muted-foreground border-b">
                              <tr>
                                <th className="py-2 pr-4">Type d'erreur</th>
                                <th className="py-2 pr-4">Compétence</th>
                                <th className="py-2 pr-4">Nature</th>
                                <th className="py-2 pr-4">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recentStudentErrors.map((ev, i) => (
                                <tr key={i} className="border-b hover:bg-muted/40">
                                  <td className="py-2 pr-4">
                                    {typesErreur[ev.type_erreur_id || ""] || ev.type_erreur_id || "—"}
                                  </td>
                                  <td className="py-2 pr-4">
                                    {ev.competence ? <Badge variant="outline">{ev.competence}</Badge> : "—"}
                                  </td>
                                  <td className="py-2 pr-4">
                                    {ev.event_type === "erreur_repetee" ? (
                                      <Badge variant="destructive">Répétée</Badge>
                                    ) : (
                                      <Badge variant="secondary">Incorrecte</Badge>
                                    )}
                                  </td>
                                  <td className="py-2 pr-4 text-xs text-muted-foreground">
                                    {new Date(ev.created_at).toLocaleString("fr-FR")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
      <GenerateTargetedExerciseWizard
        open={!!wizardTarget}
        onOpenChange={(open) => { if (!open) setWizardTarget(null); }}
        eleveId={wizardTarget?.eleveId}
        sessionId={wizardTarget?.sessionId}
        mode="session_live"
      />
    </div>
  );
}

export default function AnalyticsErreursPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0b234a]">Analyse des erreurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Analysez les tendances globales, par séance ou par élève (compétences CO/CE/EE/EO/ST).
        </p>
      </div>
      <Tabs defaultValue="global">
        <TabsList className="grid h-auto w-full max-w-2xl grid-cols-2">
          <TabsTrigger value="global">Vue globale</TabsTrigger>
          <TabsTrigger value="session">Vue par séance</TabsTrigger>
        </TabsList>
        <TabsContent value="global">
          <GlobalErrorAnalytics />
        </TabsContent>
        <TabsContent value="session">
          <GlobalErrorAnalytics sessionScoped />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: number | string; tone?: "success" | "warning" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 truncate ${tone === "warning" ? "text-orange-600" : tone === "success" ? "text-green-600" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <div className="text-sm text-muted-foreground py-12 text-center">Aucune donnée pour cette période.</div>;
}
