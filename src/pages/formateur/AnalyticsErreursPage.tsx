import { useEffect, useMemo, useRef, useState } from "react";
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
import { Loader2, Volume2, RefreshCw, FileDown, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useExportPDF } from "@/hooks/useExportPDF";
import GenerateTargetedExerciseWizard from "@/components/formateur/GenerateTargetedExerciseWizard";
import { useQuery } from "@tanstack/react-query";

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

const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

function GlobalErrorAnalytics({ sessionScoped = false }: { sessionScoped?: boolean }) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [typesErreur, setTypesErreur] = useState<Record<string, string>>({});
  const [systemInterventions, setSystemInterventions] = useState<any[]>([]);
  const [studentRows, setStudentRows] = useState<StudentErrorRow[]>([]);
  const [wizardTarget, setWizardTarget] = useState<{ eleveId: string; sessionId: string } | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const { exportPDF, isExporting } = useExportPDF(exportRef);

  const { data: sessions = [] } = useQuery({
    queryKey: ["error-analysis-sessions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, groups!inner(formateur_id)")
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
    if (sessionScoped && !selectedSessionId) return;
    void load();
  }, [period, selectedSessionId, sessionScoped]);

  async function load() {
    setLoading(true);
    try {
      const since = new Date(Date.now() - Number(period) * 24 * 3600 * 1000).toISOString();

      let eventsQuery = supabase
          .from("session_live_events")
          .select("session_id, type_erreur_id, competence, event_type, created_at, eleve_id, payload")
          .in("event_type", ["reponse_incorrecte", "erreur_repetee", "intervention_recue"])
          .gte("created_at", since)
          .limit(5000);
      if (sessionScoped && selectedSessionId) eventsQuery = eventsQuery.eq("session_id", selectedSessionId);

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
      (types || []).forEach((t: any) => (typeMap[t.id] = t.libelle));
      setTypesErreur(typeMap);
      setSystemInterventions(interv || []);

      // Aggregate: (type_erreur_id × competence) → counts
      const map = new Map<string, Row>();
      (events || []).forEach((ev: any) => {
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
      setRows(Array.from(map.values()).sort((a, b) => b.occurrences - a.occurrences));

      const errorEvents = (events || []).filter((event: any) =>
        event.eleve_id && (event.event_type === "reponse_incorrecte" || event.event_type === "erreur_repetee")
      );
      const eleveIds = [...new Set(errorEvents.map((event: any) => event.eleve_id))] as string[];
      const { data: profiles } = eleveIds.length
        ? await supabase.from("profiles").select("id, nom, prenom").in("id", eleveIds)
        : { data: [] };
      const names = new Map((profiles ?? []).map((profile: any) => [
        profile.id, `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || "Élève",
      ]));
      const students = new Map<string, StudentErrorRow>();
      for (const event of errorEvents as any[]) {
        const current = students.get(event.eleve_id) ?? {
          eleve_id: event.eleve_id,
          nom: names.get(event.eleve_id) ?? "Élève",
          total: 0,
          repeated: 0,
          competences: [],
          session_id: event.session_id,
        };
        if (event.event_type === "reponse_incorrecte") current.total += 1;
        if (event.event_type === "erreur_repetee") current.repeated += 1;
        if (event.competence && !current.competences.includes(event.competence)) current.competences.push(event.competence);
        students.set(event.eleve_id, current);
      }
      setStudentRows([...students.values()].sort((a, b) => b.total - a.total));
    } catch (e: any) {
      toast.error("Erreur de chargement : " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateAllAudio() {
    setBulkLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-interventions-audio", {
        body: { limit: 200 },
      });
      if (error) throw error;
      toast.success(`Audio généré : ${data.success || 0} ✓ / ${data.failed || 0} ✗`);
      await load();
    } catch (e: any) {
      toast.error("Échec génération : " + e.message);
    } finally {
      setBulkLoading(false);
    }
  }

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

  const totalErreurs = rows.reduce((s, r) => s + r.occurrences, 0);
  const totalDispatched = rows.reduce((s, r) => s + r.interventions_dispatched, 0);
  const audioReady = systemInterventions.filter((i) => i.audio_url).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Analytics erreurs & interventions</h1>
          <p className="text-sm text-muted-foreground">
            Top erreurs détectées et dispatch automatique d'interventions audio.
          </p>
        </div>
        <div className="flex gap-2">
          {sessionScoped && (
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Choisir une séance" /></SelectTrigger>
              <SelectContent>
                {sessions.map((session: any) => (
                  <SelectItem key={session.id} value={session.id}>{session.titre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="90">90 jours</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={generateAllAudio} disabled={bulkLoading}>
            {bulkLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Volume2 className="h-4 w-4 mr-2" />}
            Générer audio manquant
          </Button>
          <Button variant="outline" onClick={() => exportPDF({ filename: `analytics-erreurs-${new Date().toISOString().slice(0,10)}.pdf` })} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            Télécharger PDF
          </Button>
          <Button variant="outline" onClick={() => exportPDF({ sendByEmail: true, sessionTitre: "Analytics erreurs", sessionDate: new Date().toISOString().slice(0,10), formateurEmail: user?.email })} disabled={isExporting}>
            <Mail className="h-4 w-4 mr-2" />
            Envoyer par e-mail
          </Button>
        </div>
      </div>

      <div ref={exportRef} className="space-y-6">
      {/* KPIs */}
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

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="details">Détails</TabsTrigger>
          <TabsTrigger value="library">Bibliothèque système</TabsTrigger>
          <TabsTrigger value="students">Par élève</TabsTrigger>
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

        <TabsContent value="students">
          <Card>
            <CardHeader><CardTitle className="text-base">Erreurs par élève</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {studentRows.length === 0 ? <Empty /> : studentRows.map((student) => (
                <div key={student.eleve_id} className="flex items-center justify-between gap-3 border-b py-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{student.nom}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline">{student.total} erreur(s)</Badge>
                      {student.repeated > 0 && <Badge variant="destructive">{student.repeated} répétée(s)</Badge>}
                      {student.competences.map((competence) => <Badge key={competence} variant="secondary">{competence}</Badge>)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={!student.session_id}
                    onClick={() => student.session_id && setWizardTarget({ eleveId: student.eleve_id, sessionId: student.session_id })}
                  >
                    Envoyer un exercice
                  </Button>
                </div>
              ))}
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
          Analysez les tendances globales ou concentrez-vous sur une séance précise.
        </p>
      </div>
      <Tabs defaultValue="global">
        <TabsList className="grid h-auto w-full max-w-xl grid-cols-2">
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
        <div className={`text-2xl font-bold mt-1 ${tone === "warning" ? "text-orange-600" : tone === "success" ? "text-green-600" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <div className="text-sm text-muted-foreground py-12 text-center">Aucune donnée pour cette période.</div>;
}
